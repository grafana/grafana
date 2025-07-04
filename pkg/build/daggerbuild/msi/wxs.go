package msi

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"
	"text/template"
)

type wxsCfg struct {
	GrafanaVersion string
	UpgradeCode    string
	ProductName    string
	Title          string
	Manufacturer   string
	License        string
}

var semverRegex = regexp.MustCompile(`^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)

// WxsVersion converts a grafana version string (no v) to a 4-digit MSI version.
func WxsVersion(ersion string) string {
	match := semverRegex.FindStringSubmatch(ersion)
	result := make(map[string]string)
	for i, name := range semverRegex.SubexpNames() {
		if i != 0 && name != "" {
			result[name] = match[i]
		}
	}
	var major, minor, patch string
	if v, ok := result["major"]; ok {
		major = v
	}
	if v, ok := result["minor"]; ok {
		minor = v
	}
	if v, ok := result["patch"]; ok {
		patch = v
	}

	if v, ok := result["buildmetadata"]; ok && v != "" {
		return fmt.Sprintf("%s.%s.%s.%s", result["major"], result["minor"], result["patch"], strings.TrimPrefix(v, "security-"))
	}
	if v, ok := result["prerelease"]; ok && v != "" {
		v := strings.TrimPrefix(v, "beta")
		v = strings.TrimPrefix(v, "pre")

		if v == "local" {
			v = "0"
		}

		if len(v) > 5 {
			v = v[len(v)-5:]
		}
		return fmt.Sprintf("%s.%s.%s.%s", major, minor, patch, v)
	}
	return fmt.Sprintf("%s.%s.%s.0", major, minor, patch)
}

type WXSFile struct {
	Name     string
	Contents string
}

func WXSFiles(version string, enterprise bool) ([]WXSFile, error) {
	upgradeCode := "35c7d2a9-6e23-4645-b975-e8693a1cef10"
	prodName := "GrafanaOSS"
	title := "Grafana OSS"
	license := "LICENSE.rtf"

	if enterprise {
		upgradeCode = "d534ec50-476b-4edc-a25e-fe854c949f4f"
		prodName = "GrafanaEnterprise"
		title = "Grafana Enterprise"
		license = "EE_LICENSE.rtf"
	}

	ersion := strings.TrimPrefix(version, "v")

	cfg := wxsCfg{
		GrafanaVersion: WxsVersion(ersion),
		UpgradeCode:    upgradeCode,
		ProductName:    prodName,
		Title:          title,
		Manufacturer:   "Grafana Labs",
		License:        license,
	}

	files := make([]WXSFile, len(wxsTemplates))
	for i, t := range wxsTemplates {
		name := fmt.Sprintf("grafana-%s.wxs", t.Name())
		buf := bytes.NewBuffer(nil)
		if err := t.Execute(buf, cfg); err != nil {
			return nil, err
		}

		files[i] = WXSFile{
			Name:     name,
			Contents: buf.String(),
		}
	}

	return files, nil
}

var wxsTemplates = []*template.Template{
	template.Must(template.New("firewall").Parse(firewallTemplate)),
	template.Must(template.New("service").Parse(svcTemplate)),
	template.Must(template.New("product").Parse(prodTemplate)),
}

const firewallTemplate = `<?xml version="1.0" encoding="utf-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi"
     xmlns:fire="http://schemas.microsoft.com/wix/FirewallExtension">
  <Fragment>
      <ComponentGroup Id="GrafanaFirewallExceptionsGroup">
        <Component Id="FirewallGrafanaServer" Guid="7278f07d-de6f-497f-9267-d5feb5216a5c" Directory="INSTALLDIR">
          <File KeyPath="yes" Source="SourceDir\grafana\bin\grafana-server.exe">
             <fire:FirewallException
              Id="FWX1"
              Name="Grafana Server TCP 3000"
              Port="3000"
              Profile="all"
              Protocol="tcp"
              Scope="any"/>
          </File>
        </Component>
      </ComponentGroup>
  </Fragment>
</Wix>
`

const prodTemplate = `<?xml version="1.0"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*"
    UpgradeCode="{{.UpgradeCode}}"
    Name="{{.ProductName}}"
    Version="{{.GrafanaVersion}}"
    Manufacturer="{{.Manufacturer}}"
    Language="1033">
    {{ $version := .GrafanaVersion }}
    <Package
      Platform="x64"
      InstallerVersion="200"
      Compressed="yes"
      Comments="Windows Installer Package"/>

    <MediaTemplate EmbedCab="yes" />

    <MajorUpgrade
      DowngradeErrorMessage="A newer version of Grafana is already installed. Uninstall the current version to install this older version. Setup will now exit."/>

    <Icon Id="icon.ico" SourceFile="grafana_icon.ico"/>

    <WixVariable Id="WixUILicenseRtf" Value="{{.License}}" />
    <WixVariable Id="WixUIBannerBmp" Value="grafana_top_banner_white.bmp" />
    <WixVariable Id="WixUIDialogBmp" Value="grafana_dialog_background.bmp" />

    <Property Id="ARPPRODUCTICON" Value="icon.ico" />
    <Property Id="ARPHELPLINK" Value="https://www.grafana.com" />
    <Property Id="ARPURLINFOABOUT" Value="https://www.grafana.com" />
    <SetProperty Id="ARPINSTALLLOCATION" Value="[ApplicationFolder]"
      After="CostFinalize" />

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="GrafanaLabs">
          <Directory Id="GrafanaX64Dir" />
          <Directory Id="GrafanaServiceX64Dir" Name="svc-{{$version}}" />
        </Directory>
      </Directory>
    </Directory>

    <Feature Id="DefaultFeature" Title="Grafana" Display="expand" ConfigurableDirectory="INSTALLDIR">
      <Feature Id="{{.ProductName }}" Title="{{ .Title }}" Level="1">
        <ComponentGroupRef Id="GrafanaX64" />
      </Feature>
      <Feature Id="GrafanaServiceFeature" Title="Run Grafana as a Service" Level="1">
        <ComponentGroupRef Id="GrafanaServiceX64" />
      </Feature>
    </Feature>

    <Property Id="WIXUI_INSTALLDIR" Value="INSTALLDIR" />
	<UIRef Id="WixUI_FeatureTree"/>
   </Product>
</Wix>
`

const svcTemplate = `<?xml version="1.0" encoding="utf-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi"
     xmlns:util="http://schemas.microsoft.com/wix/UtilExtension">

  <Fragment>
    <ComponentGroup Id="GrafanaServiceX64" Directory="GrafanaServiceX64Dir">
      <Component Id="nssm_component" Guid="*">
        <File Id="nssm" KeyPath="yes" Source="SourceDir\nssm-2.24\win64\nssm.exe" />

        <ServiceInstall Id="ServiceInstall"
          Account="LocalSystem"
          ErrorControl="normal"
          Name="Grafana"
          Start="auto"
          Type="ownProcess"
          Vital="yes"
          Description="Grafana by Grafana Labs"
          DisplayName="Grafana">
          <ServiceConfig OnInstall="yes" OnReinstall="yes" DelayedAutoStart="no" />
        </ServiceInstall>

        <ServiceControl Id="ControlService"
          Name="Grafana"
          Wait="yes"
          Start="install"
          Stop="both"
          Remove="uninstall"
        />

        <RegistryKey Root="HKLM" Key="SYSTEM\CurrentControlSet\Services\Grafana">
          <RegistryKey Key="Parameters">
            <RegistryValue Name="AppDirectory" Value="[INSTALLDIR]grafana" Type="expandable" />
            <RegistryValue Name="Application" Value="[INSTALLDIR]grafana\bin\grafana-server.exe" Type="expandable" />
            <RegistryValue Name="AppParameters" Value='' Type="expandable" />

            <RegistryValue Name="AppEnvironmentExtra" Type="multiString">
              <MultiStringValue>LOG_LEVEL=DEBUG</MultiStringValue>
            </RegistryValue>

            <RegistryValue Name="AppStdout" Value="[LOGDIR]grafana-service.log" Type="expandable" />
            <RegistryValue Name="AppStderr" Value="[LOGDIR]grafana-service.log" Type="expandable" />
            <RegistryValue Name="AppRotateFiles" Value="1" Type="integer" />
            <RegistryValue Name="AppRotateOnline" Value="1" Type="integer" />

            <!-- Rotate after 100 MB -->
            <RegistryValue Name="AppRotateBytes" Value="104857600" Type="integer" />
            <RegistryValue Name="AppStdoutCopyAndTruncate" Value="1" Type="integer" />
            <RegistryValue Name="AppStderrCopyAndTruncate" Value="1" Type="integer" />
            <RegistryValue Name="AppRotateDelay" Value="1000" Type="integer" />

            <RegistryKey Key="AppExit">
              <RegistryValue Type="string" Value="Restart" />
            </RegistryKey>
          </RegistryKey>
        </RegistryKey>
      </Component>
    </ComponentGroup>
  </Fragment>
</Wix>
`
