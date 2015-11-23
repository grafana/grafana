package endpointdiscovery

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"strings"
)

func init() {
	bus.AddHandler("endpoint", DiscoverEndpoint)
}

type Endpoint struct {
	Host string
	IsIP bool
	URL  *url.URL
}

func NewEndpoint(domainName string) (*Endpoint, error) {
	e := &Endpoint{Host: domainName}
	if strings.Contains(domainName, "://") {
		u, err := url.Parse(domainName)
		if err != nil {
			return nil, err
		}
		e.Host = strings.Split(u.Host, ":")[0]
		e.URL = u
	}
	e.Host = strings.ToLower(e.Host)

	if net.ParseIP(e.Host) != nil {
		// the parsed host is an IP address.
		e.IsIP = true
		return e, nil
	}

	addr, err := net.LookupHost(e.Host)
	if err != nil || len(addr) < 1 {
		e.Host = "www." + domainName
		addr, err = net.LookupHost(e.Host)
		if err != nil || len(addr) < 1 {
			return nil, fmt.Errorf("failed to lookup IP of domain %s.", e.Host)
		}
	}

	return e, nil
}

func DiscoverEndpoint(cmd *m.EndpointDiscoveryCommand) error {
	monitors := make([]*m.SuggestedMonitor, 0)

	endpoint, err := NewEndpoint(cmd.Name)
	if err != nil {
		return err
	}

	pingMonitor, err := DiscoverPing(endpoint)
	if err == nil {
		monitors = append(monitors, pingMonitor)
	}

	httpMonitor, err := DiscoverHttp(endpoint)
	if err == nil {
		monitors = append(monitors, httpMonitor)
	}

	httpsMonitor, err := DiscoverHttps(endpoint)
	if err == nil {
		monitors = append(monitors, httpsMonitor)
	}

	if !endpoint.IsIP {
		dnsMonitor, err := DiscoverDNS(endpoint)
		if err == nil {
			monitors = append(monitors, dnsMonitor)
		}
	}

	cmd.Result = monitors
	return nil

}

func DiscoverPing(endpoint *Endpoint) (*m.SuggestedMonitor, error) {
	err := exec.Command("ping", "-c 3", "-W 1", "-q", endpoint.Host).Run()
	if err != nil {
		return nil, errors.New("host unreachable")
	}

	settings := []m.MonitorSettingDTO{
		{Variable: "hostname", Value: endpoint.Host},
	}

	return &m.SuggestedMonitor{MonitorTypeId: 3, Settings: settings}, nil
}

func DiscoverHttp(endpoint *Endpoint) (*m.SuggestedMonitor, error) {
	host := endpoint.Host
	path := "/"
	if endpoint.URL != nil {
		if endpoint.URL.Scheme == "http" {
			host = endpoint.URL.Host
		}
		path = endpoint.URL.Path
	}
	resp, err := http.Head(fmt.Sprintf("http://%s%s", host, path))
	if err != nil {
		return nil, err
	}

	requestUrl := resp.Request.URL
	if requestUrl.Scheme != "http" {
		return nil, errors.New("HTTP redirects to HTTPS")
	}

	hostParts := strings.Split(requestUrl.Host, ":")
	varHost := hostParts[0]
	varPort := "80"
	if len(hostParts) > 1 {
		varPort = hostParts[1]
	}

	settings := []m.MonitorSettingDTO{
		{Variable: "host", Value: varHost},
		{Variable: "port", Value: varPort},
		{Variable: "path", Value: requestUrl.Path},
	}

	return &m.SuggestedMonitor{MonitorTypeId: 1, Settings: settings}, nil
}

func DiscoverHttps(endpoint *Endpoint) (*m.SuggestedMonitor, error) {
	host := endpoint.Host
	path := "/"
	if endpoint.URL != nil {
		if endpoint.URL.Scheme == "https" {
			host = endpoint.URL.Host
		}
		path = endpoint.URL.Path
	}
	resp, err := http.Head(fmt.Sprintf("https://%s%s", host, path))
	if err != nil {
		return nil, err
	}
	requestUrl := resp.Request.URL

	hostParts := strings.Split(requestUrl.Host, ":")
	varHost := hostParts[0]
	varPort := "443"
	if len(hostParts) > 1 {
		varPort = hostParts[1]
	}

	settings := []m.MonitorSettingDTO{
		{Variable: "host", Value: varHost},
		{Variable: "port", Value: varPort},
		{Variable: "path", Value: requestUrl.Path},
	}
	return &m.SuggestedMonitor{MonitorTypeId: 2, Settings: settings}, nil
}

func DiscoverDNS(endpoint *Endpoint) (*m.SuggestedMonitor, error) {
	domain := endpoint.Host
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
			servers := make([]string, len(nameservers))
			for i, ns := range nameservers {
				s := strings.TrimSuffix(ns.Host, ".")
				servers[i] = s
			}
			server = strings.Join(servers, ",")
			break
		}
	}

	settings := []m.MonitorSettingDTO{
		{Variable: "name", Value: recordName},
		{Variable: "type", Value: recordType},
		{Variable: "server", Value: server},
	}
	return &m.SuggestedMonitor{MonitorTypeId: 4, Settings: settings}, nil
}
