---
title: Deploy on Kubernetes
weight: 2
---

## Deploy Grafana on Kubernetes

This page explains how to install and run Grafana on Kubernetes (K8S). It uses Kubernetes manifests for the setup. If you prefer Helm, refer to the [Grafana Helm community charts](https://github.com/grafana/helm-charts). 

For those interested in Grafana Enterprise (not Grafana OS), please jump to [Deploy Grafana Enterprise on Kubernetes](#deploy-grafana-enterprise-on-kubernetes)

#### Create Grafana Kubernetes manifest
1. Create the file `grafana.yaml`, then paste the following contents in it. 

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
        - image: grafana/grafana:latest
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
      volumes:
        - name: grafana
          persistentVolumeClaim:
            claimName: grafana
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


### Send manifest to Kubernetes API Server

Run the following command to create the necessary resources in your cluster. 
```bash
kubectl apply -f grafana.yaml
```

### Check that it worked
Run the following: 
```bash
kubectl port-forward service/grafana 3000:3000
```
Now if you navigate to `localhost:3000` in your browser, you should see a Grafana login page. Use `admin` for both the username and password values to login.

## Deploy Grafana Enterprise on Kubernetes
The process for deploying Grafana Enterprise is almost identical to the process above, except for some extra steps required to add in your license file.

### Obtain Grafana Enterprise License
To run Grafana Enterprise, you need a valid license. To obtain a license, [contact a Grafana Labs representative](https://grafana.com/contact?about=grafana-enterprise). This guide will assume you already have done this and have a `license.jwt` file. Your license should also be associated with a URL, which we will use further down in this guide. 

### Create License Secret
Create a Kubernetes secret from your license file using the following command:
```bash
kubectl create secret generic ge-license --from-file=/path/to/your/license.jwt
```

### Create Grafana Enterprise Config
Create a Grafana config file by creating a new file called `grafana.ini` and pasting in the contents below. You will have to update the `root_url` field to the url associated with the license you were given. 
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
Create a file called `grafana.yaml` and paste the following contents in. This yaml is identical to the yaml for the OS install except for the additional references to the Configmap that contains your Grafana config file and the Secret that contains your license.

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
 
### Send manifest to Kubernetes API Server

Run the following command to create the necessary resources in your cluster. 
```bash
kubectl apply -f grafana.yaml
```

### Check that it worked
Run the following: 
```bash
kubectl port-forward service/grafana 3000:3000
```
Now if you navigate to `localhost:3000` in your browser, you should see a Grafana login page. Use `admin` for both the username and password values to login.

A successful Grafana Enterprise installation with a valid license should show an opened lock icon when you mouse over the shield icon in the left menu bar. You can also verify by scrolling down to the bottom of the page.
![lock_ge](../../lock_ge.png "Showing left menu")
![bottom_ge](../../bottom_ge.png "Showing bottom pane") 
