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

	memberlistKVsvc := memberlist.NewKVInitService(toMemberlistConfig(ms.settingsProvider), logger, dnsProvider, ms.registerer)
	KVStore.MemberlistKV = memberlistKVsvc.GetMemberlistKV

	ms.MemberlistKVConfig = KVStore

	ms.httpServerRouter.Path("/memberlist").Methods("GET", "POST").Handler(memberlistKVsvc)

	return memberlistKVsvc, nil
}

func toMemberlistConfig(settingsProvider setting.SettingsProvider) *memberlist.KVConfig {
	cfg := settingsProvider.Get()
	memberlistKVcfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistKVcfg)
	memberlistKVcfg.Codecs = []codec.Codec{
		ring.GetCodec(),
	}
	memberlistKVcfg.ClusterLabel = cfg.MemberlistClusterLabel
	memberlistKVcfg.ClusterLabelVerificationDisabled = cfg.MemberlistClusterLabelVerificationDisabled
	if cfg.MemberlistBindAddr != "" {
		memberlistKVcfg.TCPTransport.BindAddrs = []string{cfg.MemberlistBindAddr}
	}
	if cfg.MemberlistAdvertiseAddr != "" {
		memberlistKVcfg.AdvertiseAddr = cfg.MemberlistAdvertiseAddr
	}
	memberlistKVcfg.AdvertisePort = cfg.MemberlistAdvertisePort
	memberlistKVcfg.TCPTransport.BindPort = cfg.MemberlistAdvertisePort
	memberlistKVcfg.JoinMembers = []string{cfg.MemberlistJoinMember}

	return memberlistKVcfg
}
