package sitediscovery

import (
	"errors"
	"net"
	"fmt"
	"strings"
	"net/http"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("site", DiscoverSite)
}

func DiscoverSite(cmd *m.SiteDiscoveryCommand) error {
	cmd.Result = &m.NewSiteDTO{Site: cmd.Site}
	monitors := make([]*m.SuggestedMonitor, 0)

	domain, err := getHostName(cmd.Site.Name)
	if err != nil {
		return err
	}

	pingMonitor, err := DiscoverPing(domain)
	if err != nil {
		fmt.Println("failed to discover Ping", err)
	} else {
		monitors = append(monitors, pingMonitor)
	}
	
	httpMonitor, err := DiscoverHttp(domain)
	if err != nil {
		fmt.Println("failed to discover HTTP", err)
	} else {
		monitors = append(monitors, httpMonitor)
	}
	
	httpsMonitor, err := DiscoverHttps(domain)
	if err != nil {
		fmt.Println("failed to discover HTTPS", err)
	} else {
		monitors = append(monitors, httpsMonitor)
	}

	dnsMonitor, err := DiscoverDNS(domain)
	if err != nil {
		fmt.Println("failed to discover DNS", err)
	} else {
		monitors = append(monitors, dnsMonitor)
	}
	cmd.Result.SuggestedMonitors = monitors
	return nil

}

func DiscoverPing(domain string) (*m.SuggestedMonitor, error) {

	fmt.Println("PingHost: ", domain)
	//exec("ping", "-q", "-c 2", host)
	settings := []m.MonitorSettingDTO{
		m.MonitorSettingDTO{Variable: "hostname", Value: domain},
	}

	return &m.SuggestedMonitor{Name: domain, MonitorTypeId: 3, Settings: settings}, nil
}

func DiscoverHttp(domain string) (*m.SuggestedMonitor, error) {
	fmt.Println("HTTPHost: ", domain)
	resp, err := http.Head(fmt.Sprintf("http://%s/", domain))
	if err != nil {
		fmt.Println("failed to make HTTP call to host.", err)
		return nil, err
	}

	requestUrl := resp.Request.URL
	if requestUrl.Scheme != "http" {
		return nil, errors.New("HTTP redirects to HTTPS")
	}
	//httpHost := RequestURrl.Host
	settings := []m.MonitorSettingDTO{
		m.MonitorSettingDTO{Variable: "host", Value: requestUrl.Host},
		m.MonitorSettingDTO{Variable: "path", Value: requestUrl.Path},
	}
	return &m.SuggestedMonitor{Name: domain, MonitorTypeId: 1, Settings: settings}, nil
}

func DiscoverHttps(domain string) (*m.SuggestedMonitor, error) {
	resp, err := http.Head(fmt.Sprintf("https://%s/", domain))
	if err != nil {
		fmt.Println("failed to make HTTPS call to host.", err)
		return nil, err
	}
	requestUrl := resp.Request.URL

	settings := []m.MonitorSettingDTO{
		m.MonitorSettingDTO{Variable: "host", Value: requestUrl.Host},
		m.MonitorSettingDTO{Variable: "path", Value: requestUrl.Path},
	}
	return &m.SuggestedMonitor{Name: domain, MonitorTypeId: 2, Settings: settings}, nil
}

func DiscoverDNS(domain string) (*m.SuggestedMonitor, error) {
	recordType := "A"
	recordName := domain
	server := "8.8.8.8"
	for {
		nameservers, err := net.LookupNS(domain)
		if err != nil || len(nameservers) < 1 {
			parts := strings.Split(domain, ".")
			if len(parts) < 2 {
				break
			}
			domain = strings.Join(parts[1:], ".")
		} else {
			server = strings.TrimSuffix(nameservers[0].Host, ".")
			break
		}
	}
		
	settings := []m.MonitorSettingDTO{
		m.MonitorSettingDTO{Variable: "name", Value: recordName},
		m.MonitorSettingDTO{Variable: "type", Value: recordType},
		m.MonitorSettingDTO{Variable: "server", Value: server},
	}
	return &m.SuggestedMonitor{Name: domain, MonitorTypeId: 4, Settings: settings}, nil
}

func getHostName(domainName string) (string, error) {
	host := strings.ToLower(domainName)
	addr, err := net.LookupHost(host)
	if err != nil || len(addr) < 1 {
		host = "www." + domainName
		addr, err = net.LookupHost(host)
		if err != nil || len(addr) < 1 {
			return "", errors.New("failed to lookup IP of domain.")
		}
	}
	return host, nil
}