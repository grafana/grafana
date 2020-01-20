+++
title = "License Expiration"
description = ""
keywords = ["grafana", "licensing"]
type = "docs"
[menu.docs]
parent = "enterprise"
weight = 8
+++

# License expiration 

If your license has expired, then your Grafana admin needs to upload a new *license.jwt* file to the location in the `enterprise.license_path` directory (default is your Grafana data directory). This file can be downloaded from your Grafana Cloud organization’s license page. Restart Grafana once the file is in place.

Although you'll be able to access most of Grafana as usual, some functionality stops working when the license expires and a banner informs all users that the license has expired.

> You should replace your license as soon as possible. Running Grafana Enterprise with an expired license is unsupported and can lead to unexpected consequences.

## Data source permissions

Your current data source permissions will keep working as expected, but you'll be unable to add new data source permissions until the license has been renewed.

## Reporting

You won't be able to configure new reports or generate previews.
Scheduled reports will not be generated or sent.

## SAML authentication

SAML is not affected by an expired license.

## Enterprise plugins

Enterprise plugins might stop working.

## White labeling

The white labeling feature is turned off, meaning that any white labeling options will not have any effect.
