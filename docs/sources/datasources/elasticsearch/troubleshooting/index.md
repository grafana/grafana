---
aliases:
  - ../../data-sources/elasticsearch/troubleshooting/
description: Troubleshooting the Elasticsearch data source in Grafana
keywords:
  - grafana
  - elasticsearch
  - troubleshooting
  - errors
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot issues with the Elasticsearch data source
weight: 600
---

# Troubleshoot issues with the Elasticsearch data source

This document provides troubleshooting information for common errors you may encounter when using the Elasticsearch data source in Grafana.

## Connection errors

The following errors occur when Grafana cannot establish or maintain a connection to Elasticsearch.

### Failed to connect to Elasticsearch

**Error message:** "Health check failed: Failed to connect to Elasticsearch"

**Cause:** Grafana cannot establish a network connection to the Elasticsearch server.

**Solution:**

1. Verify that the Elasticsearch URL is correct in the data source configuration.
1. Check that Elasticsearch is running and accessible from the Grafana server.
1. Ensure there are no firewall rules blocking the connection.
1. If using a proxy, verify the proxy settings are correct.
1. For Grafana Cloud, ensure you have configured [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if your Elasticsearch instance is not publicly accessible.

### Request timed out

**Error message:** "Health check failed: Elasticsearch data source is not healthy. Request timed out"

**Cause:** The connection to Elasticsearch timed out before receiving a response.

**Solution:**

1. Check the network latency between Grafana and Elasticsearch.
1. Verify that Elasticsearch is not overloaded or experiencing performance issues.
1. Increase the timeout setting in the data source configuration if needed.
1. Check if any network devices (load balancers, proxies) are timing out the connection.

### Failed to parse data source URL

**Error message:** "Failed to parse data source URL"

**Cause:** The URL entered in the data source configuration is not valid.

**Solution:**

1. Verify the URL format is correct (for example, `http://localhost:9200` or `https://elasticsearch.example.com:9200`).
1. Ensure the URL includes the protocol (`http://` or `https://`).
1. Remove any trailing slashes or invalid characters from the URL.

## Authentication errors

The following errors occur when there are issues with authentication credentials or permissions.

### Unauthorized (401)

**Error message:** "Health check failed: Elasticsearch data source is not healthy. Status: 401 Unauthorized"

**Cause:** The authentication credentials are invalid or missing.

**Solution:**

1. Verify that the username and password are correct.
1. If using an API key, ensure the key is valid and has not expired.
1. Check that the authentication method selected matches your Elasticsearch configuration.
1. Verify the user has the required permissions to access the Elasticsearch cluster.

### Forbidden (403)

**Error message:** "Health check failed: Elasticsearch data source is not healthy. Status: 403 Forbidden"

**Cause:** The authenticated user does not have permission to access the requested resource.

**Solution:**

1. Verify the user has read access to the specified index.
1. Check Elasticsearch security settings and role mappings.
1. Ensure the user has permission to access the `_cluster/health` endpoint.
1. If using AWS Elasticsearch Service with SigV4 authentication, verify the IAM policy grants the required permissions.

## Cluster health errors

The following errors occur when the Elasticsearch cluster is unhealthy or unavailable.

### Cluster status is red

**Error message:** "Health check failed: Elasticsearch data source is not healthy"

**Cause:** The Elasticsearch cluster health status is red, indicating one or more primary shards are not allocated.

**Solution:**

1. Check the Elasticsearch cluster health using `GET /_cluster/health`.
1. Review Elasticsearch logs for errors.
1. Verify all nodes in the cluster are running and connected.
1. Check for unassigned shards using `GET /_cat/shards?v&h=index,shard,prirep,state,unassigned.reason`.
1. Consider increasing the cluster's resources or reducing the number of shards.

### Bad Gateway (502)

**Error message:** "Health check failed: Elasticsearch data source is not healthy. Status: 502 Bad Gateway"

**Cause:** A proxy or load balancer between Grafana and Elasticsearch returned an error.

**Solution:**

1. Check the health of any proxies or load balancers in the connection path.
1. Verify Elasticsearch is running and accepting connections.
1. Review proxy/load balancer logs for more details.
1. Ensure the proxy timeout is configured appropriately for Elasticsearch requests.

## Index errors

The following errors occur when there are issues with the configured index or index pattern.

### Index not found

**Error message:** "Error validating index: index_not_found"

**Cause:** The specified index or index pattern does not match any existing indices.

**Solution:**

1. Verify the index name or pattern in the data source configuration.
1. Check that the index exists using `GET /_cat/indices`.
1. If using a time-based index pattern (for example, `[logs-]YYYY.MM.DD`), ensure indices exist for the selected time range.
1. Verify the user has permission to access the index.

### Time field not found

**Error message:** "Could not find time field '@timestamp' with type date in index"

**Cause:** The specified time field does not exist in the index or is not of type `date`.

**Solution:**

1. Verify the time field name in the data source configuration matches the field in your index.
1. Check the field mapping using `GET /<index>/_mapping`.
1. Ensure the time field is mapped as a `date` type, not `text` or `keyword`.
1. If the field name is different (for example, `timestamp` instead of `@timestamp`), update the data source configuration.

## Query errors

The following errors occur when there are issues with query syntax or configuration.

### Too many buckets

**Error message:** "Trying to create too many buckets. Must be less than or equal to: [65536]."

**Cause:** The query is generating more aggregation buckets than Elasticsearch allows.

**Solution:**

1. Reduce the time range of your query.
1. Increase the date histogram interval (for example, change from `10s` to `1m`).
1. Add filters to reduce the number of documents being aggregated.
1. Increase the `search.max_buckets` setting in Elasticsearch (requires cluster admin access).

### Required field missing

**Error message:** "Required one of fields [field, script], but none were specified."

**Cause:** A metric aggregation (such as Average, Sum, or Min) was added without specifying a field.

**Solution:**

1. Select a field for the metric aggregation in the query editor.
1. Ensure the selected field exists in your index and contains numeric data.

### Unsupported interval

**Error message:** "unsupported interval '&lt;interval&gt;'"

**Cause:** The interval specified for the index pattern is not valid.

**Solution:**

1. Use a supported interval: `Hourly`, `Daily`, `Weekly`, `Monthly`, or `Yearly`.
1. If you don't need a time-based index pattern, use `No pattern` and specify the exact index name.

## Version errors

The following errors occur when there are Elasticsearch version compatibility issues.

### Unsupported Elasticsearch version

**Error message:** "Support for Elasticsearch versions after their end-of-life (currently versions &lt; 7.16) was removed. Using unsupported version of Elasticsearch may lead to unexpected and incorrect results."

**Cause:** The Elasticsearch version is no longer supported by the Grafana data source.

**Solution:**

1. Upgrade Elasticsearch to a supported version (7.17+, 8.x, or 9.x).
1. Refer to [Elastic Product End of Life Dates](https://www.elastic.co/support/eol) for version support information.
1. Note that queries may still work, but Grafana does not guarantee functionality for unsupported versions.

## Other common issues

The following issues don't produce specific error messages but are commonly encountered.

### Empty query results

**Cause:** The query returns no data.

**Solution:**

1. Verify the time range includes data in your index.
1. Check the Lucene query syntax for errors.
1. Test the query directly in Elasticsearch using the `_search` API.
1. Ensure the index contains documents matching your query filters.

### Slow query performance

**Cause:** Queries take a long time to execute.

**Solution:**

1. Reduce the time range of your query.
1. Add more specific filters to limit the data scanned.
1. Increase the date histogram interval.
1. Check Elasticsearch cluster performance and resource utilization.
1. Consider using index aliases or data streams for better query routing.

### CORS errors in browser console

**Cause:** Cross-Origin Resource Sharing (CORS) is blocking requests from the browser to Elasticsearch.

**Solution:**

1. Use Server (proxy) access mode instead of Browser access mode in the data source configuration.
1. If Browser access is required, configure CORS settings in Elasticsearch:

```yaml
http.cors.enabled: true
http.cors.allow-origin: '<your-grafana-url>'
http.cors.allow-headers: 'Authorization, Content-Type'
http.cors.allow-credentials: true
```

{{< admonition type="note" >}}
Server (proxy) access mode is recommended for security and reliability.
{{< /admonition >}}

## Get additional help

If you continue to experience issues after following this troubleshooting guide:

1. Check the [Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html) for API-specific guidance.
1. Review the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Contact Grafana Support if you have an Enterprise license.
