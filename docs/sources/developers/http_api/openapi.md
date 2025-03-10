---
title: OpenAPI docs example
description: An example of API docs generated from the Documentation and Technical Writing team's Hugo OpenAPI shortcodes.
---

# OpenAPI docs example

An example of API docs generated from the Documentation and Technical Writing team's [OpenAPI Hugo shortcodes](https://grafana.com/docs/writers-toolkit/write/shortcodes/#docsopenapipath).

The two examples showcase how to scope paths to those tagged with a specific tag. Use the scope attribute to compose docs into the required information architecture.

For more information on how to use the OpenAPI docs features refer to the Hugo shortcode documentation in the [Writer's Toolkit](https://grafana.com/docs/writers-toolkit/write/shortcodes/#docsopenapipath).

For an example of a production product that uses  OpenAPI docs features refer to the [Grafana Cloud k6 REST API v6 documentation](https://grafana.com/docs/grafana-cloud/testing/k6/reference/cloud-rest-api/v6/).

---

## Example with scope `api_keys`

{{< docs/openapi/path url="https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json" scope="api_keys" >}}

---

## Example with scope `dashboards`

{{< docs/openapi/path url="https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json" scope="dashboards" >}}
