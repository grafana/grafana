package server

import (
	"fmt"

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
	if !ms.cfg.EnableSharding {
		return nil, nil
	}

	if ms.cfg.MemberlistJoinMember == "" {
		return nil, fmt.Errorf("bad memberlist configuration. Missing MemberlistJoinMember")
	}

	logger := log.New("memberlist")

	dnsProviderReg := prometheus.WrapRegistererWithPrefix(
		"memberlist",
		prometheus.WrapRegistererWith(
			prometheus.Labels{"component": "memberlist"},
			ms.registerer,
		),
	)
	dnsProvider := dns.NewProvider(logger, dnsProviderReg, dns.GolangResolverType)

	KVStore := kv.Config{Store: "memberlist"}

	memberlistKVsvc := memberlist.NewKVInitService(toMemberlistConfig(ms.cfg), logger, dnsProvider, ms.registerer)
	KVStore.MemberlistKV = memberlistKVsvc.GetMemberlistKV

	ms.KVStore = KVStore

	return memberlistKVsvc, nil
}

func toMemberlistConfig(cfg *setting.Cfg) *memberlist.KVConfig {
	memberlistKVcfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistKVcfg)
	memberlistKVcfg.Codecs = []codec.Codec{
		ring.GetCodec(),
	}
	if cfg.MemberlistBindAddr != "" {
		memberlistKVcfg.AdvertiseAddr = cfg.MemberlistBindAddr
		memberlistKVcfg.TCPTransport.BindAddrs = []string{cfg.MemberlistBindAddr}
	}
	memberlistKVcfg.JoinMembers = []string{cfg.MemberlistJoinMember}

	return memberlistKVcfg
}
