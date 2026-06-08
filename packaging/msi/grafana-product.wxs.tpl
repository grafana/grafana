<?xml version="1.0"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*"
    UpgradeCode="${UPGRADE_CODE}"
    Name="${PRODUCT_NAME}"
    Version="${GRAFANA_VERSION}"
    Manufacturer="${MANUFACTURER}"
    Language="1033">
    <Package
      Platform="x64"
      InstallerVersion="200"
      Compressed="yes"
      Comments="Windows Installer Package"/>

    <MediaTemplate EmbedCab="yes" />

    <MajorUpgrade
      DowngradeErrorMessage="A newer version of Grafana is already installed. Uninstall the current version to install this older version. Setup will now exit."/>

    <Icon Id="icon.ico" SourceFile="grafana_icon.ico"/>

    <WixVariable Id="WixUILicenseRtf" Value="${LICENSE}" />
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
          <Directory Id="GrafanaX64Dir" Name="grafana" />
          <Directory Id="GrafanaServiceX64Dir" Name="svc-${GRAFANA_VERSION}" />
        </Directory>
      </Directory>
    </Directory>

    <Feature Id="DefaultFeature" Title="Grafana" Display="expand" ConfigurableDirectory="INSTALLDIR">
      <Feature Id="${PRODUCT_NAME}" Title="${TITLE}" Level="1">
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
