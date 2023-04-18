---
description: Guide for deploying Grafana on Kubernetes
keywords:
  - grafana
  - configuration
  - documentation
  - kubernetes
title: Deploy Grafana on Kubernetes
weight: 700
---

## Deploy Grafana on Kubernetes

This page explains how to install and run Grafana on Kubernetes (K8S). It uses Kubernetes manifests for the setup. If you prefer Helm, refer to the [Grafana Helm community charts](https://github.com/grafana/helm-charts).

If you are interested in Grafana Enterprise (not Grafana OS), jump to [Deploy Grafana Enterprise on Kubernetes](#deploy-grafana-enterprise-on-kubernetes) section.

### Create Grafana Kubernetes manifest

1. Create a file called `grafana.yaml`, then paste the contents below.

```yaml
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: grafana
  name: grafana
spec:
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      securityContext:
        fsGroup: 472
        supplementalGroups:
          - 0
      containers:
        - name: grafana
          image: grafana/grafana:8.4.4
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http-grafana
              protocol: TCP
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /robots.txt
              port: 3000
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 30
            successThreshold: 1
            timeoutSeconds: 2
          livenessProbe:
            failureThreshold: 3
            initialDelaySeconds: 30
            periodSeconds: 10
            successThreshold: 1
            tcpSocket:
              port: 3000
            timeoutSeconds: 1
          resources:
            requests:
              cpu: 250m
              memory: 750Mi
          volumeMounts:
            - mountPath: /var/lib/grafana
              name: grafana-pv
      volumes:
        - name: grafana-pv
          persistentVolumeClaim:
            claimName: grafana-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
spec:
  ports:
    - port: 3000
      protocol: TCP
      targetPort: http-grafana
  selector:
    app: grafana
  sessionAffinity: None
  type: LoadBalancer
```

### Send manifest to Kubernetes API server

1. Run the following command:
   `kubectl apply -f grafana.yaml`

1. Check that it worked by running the following:
   `kubectl port-forward service/grafana 3000:3000`

1. Navigate to `localhost:3000` in your browser. You should see a Grafana login page.

1. Use `admin` for both the username and password to login.

## Deploy Grafana Enterprise on Kubernetes

The process for deploying Grafana Enterprise is almost identical to the process above, except for some extra steps required to add in your license file. They are described in the following sections.

### Obtain Grafana Enterprise license

To run Grafana Enterprise, you need a valid license. [Contact a Grafana Labs representative](https://grafana.com/contact?about=grafana-enterprise) to obtain the license. This topic assumes that you already have done this and have a `license.jwt` file. Your license should also be associated with a URL, which we will use later in the topic.

### Create License Secret

Create a Kubernetes secret from your license file using the following command:

```bash
kubectl create secret generic ge-license --from-file=/path/to/your/license.jwt
```

### Create Grafana Enterprise configuration

Create a Grafana configuration file with the name `grafana.ini`. Then paste the content below.

> **Note:** You will have to update the `root_url` field to the url associated with the license you were given.

```yaml
[enterprise]
license_path = /etc/grafana/license/license.jwt
[server]
root_url =/your/license/root/url

```

### Create Configmap for Grafana Enterprise Config

Create a Kubernetes Configmap from your `grafana.ini` file with the following command:

```bash
kubectl create configmap ge-config --from-file=/path/to/your/config.ini
```

### Create Grafana Enterprise Kubernetes manifest

Create a `grafana.yaml` file, then paste the content below. This YAML is identical to the one for Grafana OS install except for the additional references to the Configmap which has your Grafana configuration file and the Secret that has your license.

```yaml
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: local-path
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: grafana
  name: grafana
spec:
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - image: grafana/grafana-enterprise:latest
          imagePullPolicy: IfNotPresent
          name: grafana
          ports:
            - containerPort: 3000
              name: http-grafana
              protocol: TCP
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /robots.txt
              port: 3000
              scheme: HTTP
            initialDelaySeconds: 10
            periodSeconds: 30
            successThreshold: 1
            timeoutSeconds: 2
          resources:
            limits:
              memory: 4Gi
            requests:
              cpu: 100m
              memory: 2Gi
          volumeMounts:
            - mountPath: /var/lib/grafana
              name: grafana
            - mountPath: /etc/grafana
              name: ge-config
            - mountPath: /etc/grafana/license
              name: ge-license
      volumes:
        - name: grafana
          persistentVolumeClaim:
            claimName: grafana
        - name: ge-config
          configMap:
            name: ge-config
        - name: ge-license
          secret:
            secretName: ge-license
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
spec:
  ports:
    - port: 3000
      protocol: TCP
      targetPort: http-grafana
  selector:
    app: grafana
  sessionAffinity: None
  type: LoadBalancer
```

1. Send manifest to Kubernetes API Server
   `kubectl apply -f grafana.yaml`

1. Check that it worked by running the following:
   `kubectl port-forward service/grafana 3000:3000`

1. Navigate to `localhost:3000` in your browser. You should see the Grafana login page.

1. Use `admin` for both the username and password to login.
   If it worked, you should see `Enterprise (Licensed)` at the bottom of the page.
