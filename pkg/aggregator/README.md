## Data Plane Aggregator

### Testing queries

1. `custom.ini` changes:
```ini
[feature_toggles]
kubernetesAggregator = true
dataplaneAggregator = true
grafanaAPIServerEnsureKubectlAccess = true
```

2. start grafana:
```bash
make run
```

3. enable aggregation for prometheus data source:
```bash
export KUBECONFIG=./data/grafana-apiserver/grafana.kubeconfig
kubectl apply -f pkg/aggregator/examples/datasource.yml --validate=false
dataplaneservice.aggregation.grafana.app/v0alpha1.prometheus.grafana.app created
```

4. edit `pkg/aggregator/examples/datasource-query.json` and update the datasource UID to match the UID of a prometheus data source.

5. execute query (replace `example` with the UID of a prometheus data source):
```bash
curl 'http://admin:admin@localhost:3000/apis/prometheus.grafana.app/v0alpha1/namespaces/default/connections/example/query' -X POST -d '@pkg/aggregator/examples/datasource-query.json'
```