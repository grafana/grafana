+++
title = "White-labeling"
description = "White-labeling"
keywords = ["grafana", "white-labeling", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/white-labeling/"]
type = "docs"
[menu.docs]
name = "White-labeling"
parent = "enterprise"
weight = 5
+++

# White labeling

> Only available in Grafana Enterprise v6.6+.

{{< docs-imagebox img="/img/docs/v66/whitelabeling_1.png" max-width="800px" caption="White labeling example" >}}

This release adds new white labeling options to the `grafana.ini` file (can also be set via ENV variables).

You can change the following elements:

- Login Background
- Login Logo
- Side menu top logo
- Footer & Help menu links
- Fav icon (shown in browser tab)

> You will have to host your logo and other images used by the white labeling feature separately

```ini
# Enterprise only
[white_labeling]
# Set to complete URL to override login logo
;login_logo =

# Set to complete css background expression to override login background
# example: login_background = url(http://www.bhmpics.com/wallpapers/starfield-1920x1080.jpg)
;login_background =

# Set to complete URL to override menu logo
;menu_logo =

# Set to complete URL to override fav icon (icon shown in browser tab)
;fav_icon =

# Set to complete URL to override apple/ios icon
;apple_touch_icon =

# Below is an example for how to replace the default footer & help links with 2 custom links
;footer_links = support guides
;footer_links_support_text = Support
;footer_links_support_url = http://your.support.site
;footer_links_guides_text = Guides
;footer_links_guides_url = http://your.guides.site
```
