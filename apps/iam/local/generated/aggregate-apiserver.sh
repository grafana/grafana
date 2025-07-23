#!/usr/bin/env bash
set -eufo pipefail

GRAFANA_RUN_MODE="${1}"
GRAFANA_HOST="grafana.k3d.localhost:9999"

if [ $GRAFANA_RUN_MODE == "in_cluster" ]; then
  KUBEAPI=($(kubectl run bash-local-env -it --rm --image=bash --restart=Never --command -- "bash" "-c" 'echo "$KUBERNETES_SERVICE_HOST $KUBERNETES_SERVICE_PORT"'))
elif [ $GRAFANA_RUN_MODE == "standalone" ]; then
  CONTROLPLANE=($(kubectl cluster-info | grep "control plane"))
  ENDPOINT=$(echo ${CONTROLPLANE[${#CONTROLPLANE[@]}-1]} | sed 's~http[s]*://~~g')
  IFS=: read -r -a KUBEAPI <<< "$ENDPOINT"
  read -p "Grafana API Server URL (host:port): " HOST
fi
HOST=${KUBEAPI[0]}
PORT=${KUBEAPI[1]}

# Create a service account token to use in our requests (anonymous auth isn't allowed for apiservices)
sa=$(curl "http://${GRAFANA_HOST}/api/serviceaccounts/" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data '{"name":"Aggregation User","role":"Admin"}' | jq .id)
echo "SA: ${sa}"
token=$(curl "http://${GRAFANA_HOST}/api/serviceaccounts/${sa}/tokens" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data '{"name":"sa-1-aggregation-user-e2a6a474-bdcd-4bac-8449-0deb7274484a"}'| jq -r '.key')
echo "TOKEN: ${token}"

curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF
curl \
  "http://${GRAFANA_HOST}/apis/apiregistration.k8s.io/v1/apiservices?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "apiregistration.k8s.io/v1",
  "kind": "APIService",
  "metadata": {
    "name": "v0alpha1.iam.grafana.app"
  },
  "spec": {
    "version": "v0alpha1",
    "insecureSkipTLSVerify": true,
    "group": "iam.grafana.app",
    "groupPriorityMinimum": 1000,
    "versionPriority": 15,
    "service": {
      "name": "example-apiserver",
      "namespace": "default",
      "port": ${PORT}
    }
  }
}
EOF


curl \
  "http://${GRAFANA_HOST}/apis/service.grafana.app/v0alpha1/namespaces/default/externalnames?fieldManager=kubectl-create&fieldValidation=Strict" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${token}" \
  --data @- << EOF
{
  "apiVersion": "service.grafana.app/v0alpha1",
  "kind": "ExternalName",
  "metadata": {
    "name": "example-apiserver",
    "namespace": "default"
  },
  "spec": {
    "host": "${HOST}"
  }
}
EOF