package server

import (
	"github.com/grafana/dskit/dns"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

func (ms *ModuleServer) initMemberlistKV() (services.Service, error) {
	logger := log.New("memberlist")

	dnsProviderReg := prometheus.WrapRegistererWithPrefix(
		"grafana",
		prometheus.WrapRegistererWith(
			prometheus.Labels{"component": "memberlist"},
			ms.registerer,
		),
	)
	dnsProvider := dns.NewProvider(logger, dnsProviderReg, dns.GolangResolverType)

	KVStore := kv.Config{Store: "memberlist"}

	memberlistKVsvc := memberlist.NewKVInitService(toMemberlistConfig(ms.cfg), logger, dnsProvider, ms.registerer)
	KVStore.MemberlistKV = memberlistKVsvc.GetMemberlistKV

	ms.MemberlistKVConfig = KVStore

	return memberlistKVsvc, nil
}

func toMemberlistConfig(cfg *setting.Cfg) *memberlist.KVConfig {
	memberlistKVcfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistKVcfg)
	memberlistKVcfg.Codecs = []codec.Codec{
		ring.GetCodec(),
	}
	if cfg.MemberlistBindAddr != "" {
		memberlistKVcfg.TCPTransport.BindAddrs = []string{cfg.MemberlistBindAddr}
	}
	if cfg.MemberlistAdvertiseAddr != "" {
		memberlistKVcfg.AdvertiseAddr = cfg.MemberlistAdvertiseAddr
	}
	memberlistKVcfg.JoinMembers = []string{cfg.MemberlistJoinMember}

	return memberlistKVcfg
}
