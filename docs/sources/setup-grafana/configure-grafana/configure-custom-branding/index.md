---
aliases:
  - ../../enterprise/white-labeling/
  - ../enable-custom-branding/
description: Change the look of Grafana to match your corporate brand.
title: Configure custom branding
weight: 300
---

# Configure custom branding

Custom branding allows you to replace the Grafana brand and logo with your own corporate brand and logo.

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud](/docs/grafana-cloud).
{{% /admonition %}}

Grafana Enterprise has custom branding options in the `grafana.ini` file. As with all configuration options, you can also set them with environment variables.

You can change the following elements:

- Application title
- Login background
- Login logo
- Side menu top logo
- Footer and help menu links
- Fav icon (shown in browser tab)
- Login title (will not appear if a login logo is set, Grafana v7.0+)
- Login subtitle (will not appear if a login logo is set, Grafana v7.0+)
- Login box background (Grafana v7.0+)
- Loading logo

> You will have to host your logo and other images used by the custom branding feature separately. Make sure Grafana can access the URL where the assets are stored.

{{< figure src="/static/img/docs/v66/whitelabeling_1.png" max-width="800px" caption="Custom branding example" >}}

The configuration file in Grafana Enterprise contains the following options. Each option is defined in the file. For more information about configuring Grafana, refer to [Configuration]({{< relref "../../configure-grafana" >}}).

```ini
# Enterprise only
[white_labeling]
# Set to your company name to override application title
;app_title =

# Set to main title on the login page (Will not appear if a login logo is set)
;login_title =

# Set to login subtitle (Will not appear if a login logo is set)
;login_subtitle =

# Set to complete URL to override login logo
;login_logo =

# Set to complete CSS background expression to override login background
# example: login_background = url(http://www.bhmpics.com/wallpapers/starfield-1920x1080.jpg)
;login_background =

# Set to complete CSS background expression to override login box background
;login_box_background =

# Set to complete URL to override menu logo
;menu_logo =

# Set to complete URL to override fav icon (icon shown in browser tab)
;fav_icon =

# Set to complete URL to override apple/ios icon
;apple_touch_icon =

# Set to complete URL to override loading logo
;loading_logo =
```

You can replace the default footer links (Documentation, Support, Community) and even add your own custom links.
An example follows for replacing the default footer and help links with new custom links.

```ini
footer_links = support guides extracustom
footer_links_support_text = Support
footer_links_support_url = http://your.support.site
footer_links_guides_text = Guides
footer_links_guides_url = http://your.guides.site
footer_links_extracustom_text = Custom text
footer_links_extracustom_url = http://your.custom.site
```

Here is the same example using environment variables instead of the custom.ini or grafana.ini file.

```
GF_WHITE_LABELING_FOOTER_LINKS=support guides extracustom
GF_WHITE_LABELING_FOOTER_LINKS_SUPPORT_TEXT=Support
GF_WHITE_LABELING_FOOTER_LINKS_SUPPORT_URL=http://your.support.site
GF_WHITE_LABELING_FOOTER_LINKS_GUIDES_TEXT=Guides
GF_WHITE_LABELING_FOOTER_LINKS_GUIDES_URL=http://your.guides.site
GF_WHITE_LABELING_FOOTER_LINKS_EXTRACUSTOM_TEXT=Custom Text
GF_WHITE_LABELING_FOOTER_LINKS_EXTRACUSTOM_URL=http://your.custom.site
```

{{% admonition type="note" %}}
The following two links are always present in the footer:
{{% /admonition %}}

- Grafana edition
- Grafana version with build number

If you specify `footer_links` or `GF_WHITE_LABELING_FOOTER_LINKS`, then all other default links are removed from the footer and only what is specified is included.

## Custom branding for Public Dashboards

In addition to the customizations described below, you can customize the footer of your public dashboards.
To customize the footer of a public dashboard, add the following section to the `grafana.ini` file.

```ini
[white_labeling.public_dashboards]

# Hides the footer for the public dashboards if set to "true". If
# example: footer_hide = "true"
;footer_hide =

# Set to text shown in the footer
;footer_text =

# Set to complete url to override public dashboard footer logo
;footer_logo =

# Set to link for the footer
;footer_link =
```

If you specify `footer_hide` to `true`, all the other values are ignored because the footer will not be shown.
