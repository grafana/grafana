---
aliases:
  - ../../installation/kubernetes/
description: Guide for deploying Grafana on Kubernetes
menuTitle: Grafana on Kubernetes
title: Deploy Grafana on Kubernetes
weight: 500
---

# Deploy Grafana on Kubernetes

This page explains how to install and run Grafana on Kubernetes (K8S). It uses Kubernetes manifests for the setup. If you prefer Helm, refer to the [Grafana Helm community charts](https://github.com/grafana/helm-charts).

## Before you begin

To follow this guide, you need:

- The latest version of Kubernetes running either locally or remotely (on a public or private cloud).

- To use in a local environment use any Kubernetes such as [Minikube](https://minikube.sigs.k8s.io/docs/), [KinD](https://kind.sigs.k8s.io/), [Docker Desktop](https://docs.docker.com/desktop/kubernetes/), and so on.

- To use managed cloud services such as [Google Kubernetes Engine (GKE)](https://cloud.google.com/kubernetes-engine), [Amazon Elastic Kubernetes Service (EKS)](https://aws.amazon.com/eks/), or [Azure Kubernetes Service (AKS)](https://azure.microsoft.com/en-us/) if you are considering using Kubernetes in a production environment.**

## System Requirements 

This section provides minimum hardware and software requirements.

### Minimum Hardware Requirements

- Disk Space = 1 GB
- Memory = 750 MiB (approx 750 MB)
- CPU = 250m (approx 2.5 cores)

### Supported databases

For a list of supported databases, refer to [supported databases](https://grafana.com/docs/grafana/latest/setup-grafana/installation/#supported-databases).

### Supported web browsers

For a list of support web browsers, refer to [supported web browsers](https://grafana.com/docs/grafana/latest/setup-grafana/installation/#supported-web-browsers).

> **Note:** Make sure to enable port 3000 in your network environment as this is the Grafana default port.

## Deploy Grafana OSS on Kubernetes

This section explains how to install Grafana OSS using Kubernetes. If you want to install Grafana Enterprise on Kubernetes,  refer to [Deploy Grafana Enterprise on Kubernetes](https://grafana.com/docs/grafana/latest/setup-grafana/installation/kubernetes/#deploy-grafana-enterprise-on-kubernetes).

When you deploy an application in Kubernetes, it will use its default namespace which may have other applications running and can cause conflicts and other issues.

As best practice, create a new namespace, as Kubernetes does allow users to create namespaces which will allow us to easily manage,  organize, allocate, and manage cluster resources. Refer to the Kubernetes official documentation for more reference about the [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/).

1. To create a namespace, run the following command:
   ```bash
   kubectl create namespace my-grafana
   ```
   In this example, the namespace is `my-grafana`

1. To verify and view the newly created namespace, run the following command:
   ```bash
   kubectl get namespace my-grafana
   ```
   The output of the command confirms that the namespace is created successfully.


1. Create a file called `grafana.yaml`. This file will contain the YAML code aka manifest for deploying Grafana.
   ```bash
   touch grafana.yaml
   ```
    In the following steps you define the following three objects in the YAML file.

    | Object | Description |
    | ------ | ------ |
    | Persistent Volume Claim (PVC) | This object stores the data. |
    | Service | This object provides network access to the Pod defined in the deployment. |
    | Deployment | This object is responsible for creating the pods, ensuring they stay up to date, and  managing Replicaset and Rolling updates. |

1. Copy and paste the following contents and save it in the grafana.yaml file.
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
             image: grafana/grafana:latest
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

1. Run the following command to send the manifest to the Kubernetes API server:
   ```bash
   kubectl apply -f grafana.yaml --namespace=my-grafana
   ```
   This command creates the PVC, Deployment, and Service objects.

1. Complete the following steps to verify the deployment status of each object.
   1. For PVC , run the following command:
         ```bash
         kubectl get pvc --namespace=my-grafana -o wide
         ```

   2. For Deployment, run the following command:
         ```bash
         kubectl get deployments --namespace=my-grafana -o wide
         ```

   3. For Services, run the following command:
         ```bash
         kubectl get svc --namespace=my-grafana -o wide
         ```

## Access Grafana on Managed K8s Providers

In this task, you access Grafana deployed on a Managed Kubernetes provider using a web browser. Accessing Grafana via a Web browser is straightforward if it is deployed on a Managed Kubernetes Providers as it uses the cloud provider’s **LoadBalancer** to which the external load balancer routes, are automatically created.

1. Run the following command to obtain the deployment information:
   ```bash
   kubectl get all --namespace=my-grafana
   ```

   The output returned should look similar to the following output:
   ```bash
   NAME                           READY   STATUS    RESTARTS   AGE
   pod/grafana-69946c9bd6-kwjb6   1/1     Running   0          7m27s

   NAME              TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)          AGE
   service/grafana   LoadBalancer   10.5.243.226   1.120.130.330   3000:31171/TCP   7m27s

   NAME                      READY   UP-TO-DATE   AVAILABLE   AGE
   deployment.apps/grafana   1/1     1            1           7m29s

   NAME                                 DESIRED   CURRENT   READY   AGE
   replicaset.apps/grafana-69946c9bd6   1         1         1       7m30s
   ```

1. Identify the `EXTERNAL-IP` value in the output and type it into your browser.
   
   The Grafana sign-in page appears.

   1. To sign in, enter `admin` for both the username and password.

1. If you do not see the EXTERNAL-IP then complete the following steps:
      
      a) Run the following command to do a port-forwarding of the Grafana service on port `3000`.

      ```bash
      kubectl port-forward service/grafana 3000:3000 --namespace=my-grafana
      ```
      
      For more information about port-forwarding, refer to [Use Port Forwarding to Access Applications in a Cluster](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/).

      b) Navigate to `localhost:3000` in your browser.

      The Grafana sign-in page appears.

      c) To sign in, enter `admin` for both the username and password.

## Accessing Grafana via Web Browser using minikube

There are multiple ways to access the Grafana UI on a web browser when using minikube. For more information about minikube, refer to [How to access applications running within minikube](https://minikube.sigs.k8s.io/docs/handbook/accessing/).

This section lists the two most common options for accessing an application running in minikube.

### Option 1 Expose the Service

This option uses the `type: LoadBalancer` in the `grafana.yaml` Service manifest, which makes the Service accessible through the `minikube service` command. For more information, refer to [minikube Service command usage](https://minikube.sigs.k8s.io/docs/commands/service/).

1. Run the following command to obtain the Grafana service IP:
   
   ```bash
   minikube service grafana -n my-grafana
   ```

   The output returns the Kubernetes URL for service in your local cluster.

   ```bash
   |------------|---------|-------------|------------------------------|
   | NAMESPACE  |  NAME   | TARGET PORT |             URL              |
   |------------|---------|-------------|------------------------------|
   | my-grafana | grafana |        3000 | http://192.168.122.144:32182 |
   |------------|---------|-------------|------------------------------|
   🎉  Opening service my-grafana/grafana in default browser...
   👉  http://192.168.122.144:32182
   ```

1. Run a curl command to verify whether a given connection should be working in a browser under ideal circumstances.
   ```bash
   curl 192.168.122.144:32182
   ```
   The following example output determines that an endpoint has been located:

   `<a href="/login">Found</a>.`

1. Access the Grafana UI in the browser using the provided IP:Port from the command above.
   
   The Grafana sign-in page appears.

     1. To sign in to Grafana, enter `admin` for both the username and password.

### Option 2 Using Port Forwarding

If Option 1 does not work in your minikube environment (mostly depends on the network), then as an alternative you can use the **port forwarding** option for the Grafana service on port `3000`.

For more information about port forwarding, refer to [Use Port Forwarding to Access Applications in a Cluster](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/).

1. To find the minikube IP address, run the following command:
   
   ```bash
   minikube ip
   ```
   
   The output contains the IP address that you use to access the Grafana Pod during port forwarding. A Pod is the smallest deployment unit in Kubernetes is the core building block for running applications in a Kubernetes cluster. For more information about Pod’s refer to the [Pod concept](https://kubernetes.io/docs/concepts/workloads/pods/).

2. To obtain the Grafana Pod information, run the following command:
   
   ```bash
   kubectl get pods --namespace=my-grafana
   ```

   The output should look similar to the following output:

   ```bash
   NAME                       READY   STATUS    RESTARTS   AGE
   grafana-58445b6986-dxrrw   1/1     Running   0          9m54s
   ```

   It shows the Grafana POD name in the NAME column, that you use for port forwarding.

1. Run the following command for enabling the port forwarding on the POD:
   ```bash
   kubectl port-forward pod/grafana-58445b6986-dxrrw --namespace=my-grafana --address 0.0.0.0 3000:3000
   ```

1. To access the Grafana UI on the web browser, type the minikube IP along with the forwarded port. For example `192.168.122.144:3000`
   
   The Grafana sign-in page appears.

   1. To sign in to Grafana, enter `admin` for both the username and password.

## Update an existing deployment using a rolling update strategy

Rolling updates allow deployment updates to take place with no downtime by incrementally updating Pods instances with new ones. The new Pods will be scheduled on nodes with available resources. For more information about rolling updates, refer to [Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/).

The following steps use the [kubectl annotate](https://jamesdefabia.github.io/docs/user-guide/kubectl/kubectl_annotate/) command to add the metadata and keep track of the deployment.
   
> **Note:** Instead of using the `annotate` flag, you can still use the `--record` flag. However, it has been deprecated and will be removed in the future version of Kubernetes.
https://github.com/kubernetes/kubernetes/issues/40422

1. To view the current status of the rollout, run the following command:
   
   ```bash
   kubectl rollout history deployment/grafana -n my-grafana
   ```
   
   The output will look similar to this:

   ```bash
   deployment.apps/grafana 
   REVISION  CHANGE-CAUSE
   1         NONE
   ```
   
   The output shows that nothing has been updated or changed after applying the `grafana.yaml` file.

1. To add metadata to keep record of the initial deployment, run the following command:
   
   ```bash
   kubectl annotate deployment/grafana kubernetes.io/change-cause='deployed the default base yaml file' -n my-grafana
   ```

1. To review the rollout history and verify the changes run the following command:

   ```bash
   kubectl rollout history deployment/grafana -n my-grafana
   ```
   You should see the updated information that you added in the CHANGE-CAUSE earlier.

### Change Grafana image version

1. To edit the Grafana version, run the following `kubectl edit` command:
   
   ```bash
   kubectl edit deployment grafana -n my-grafana
   ```
   In the editor, change the container image under the `kind: Deployment` section for e.g.:

   From

   - ```yaml image: grafana/grafana-oss:10.0.1```

   To

   - ```yaml image: grafana/grafana-oss-dev:10.1.0-124419pre```

1. Save the changes. You will get a message once your file is saved:
   ```bash
   deployment.apps/grafana edited
   ```
   This means that the new changes have been applied.

1. To verify that the rollout on the cluster is successful, run the following command:
   ```bash
   kubectl rollout status deployment grafana -n my-grafana
   ```
   A successful deployment rollout means that the Grafana Dev cluster is now available.

1. To check the statuses of all deployed objects, run the following commands and include the -o wide flag because it provides a more detailed output:
   ```bash
   kubectl get all -n my-grafana -o wide
   ```
   You should see the newly deployed `grafana-oss-dev` image.

1. To verify it, access the Grafana UI in the browser using the provided IP:Port from the command above.
   
   The Grafana sign-in page appears.

     1. To sign in to Grafana, enter `admin` for both the username and password.
     2. On the top right corner, click the help icon which will display the version.
  
1. Add the change cause metadata to keep track of things using the commands:
   ```bash
   kubectl annotate deployment grafana -n my-grafana kubernetes.io/change-cause='using grafana-oss-dev:10.1.0-124419pre for testing'
   ```
1. To verify, run the `kubectl rollout history` command:
   ```bash
   kubectl rollout history deployment grafana -n my-grafana
   ```
   You will see an output similar to this:
   ```bash
   deployment.apps/grafana 
   REVISION  CHANGE-CAUSE
   1         deploying the default yaml
   2         using grafana-oss-dev:10.1.0-124419pre for testing
   ```
This means that REVISION#2 is the current version. 


### Rollback a deployment



































### Send the manifest to the Kubernetes API server

1. Run the following command:
   `kubectl apply -f grafana.yaml`

1. Check that it worked by running the following:
   `kubectl port-forward service/grafana 3000:3000`

1. Navigate to `localhost:3000` in your browser. You should see a Grafana login page.

1. Use `admin` for both the username and password to login.

## Deploy Grafana Enterprise on Kubernetes

The process for deploying Grafana Enterprise is almost identical to the preceding process, except for additional steps that are required for adding your license file.

### Obtain Grafana Enterprise license

To run Grafana Enterprise, you need a valid license.
To obtain a license, [contact a Grafana Labs representative](/contact?about=grafana-enterprise).
This topic assumes that you have a valid license in a `license.jwt` file.
Associate your license with a URL that you can use later in the topic.

### Create license secret

Create a Kubernetes secret from your license file using the following command:

```bash
kubectl create secret generic ge-license --from-file=/path/to/your/license.jwt
```

### Create Grafana Enterprise configuration

Create a Grafana configuration file with the name `grafana.ini`. Then paste the content below.

{{% admonition type="note" %}}
You will have to update the `root_url` field to the url associated with the license you were given.
{{% /admonition %}}

```yaml
[enterprise]
license_path = /etc/grafana/license/license.jwt
[server]
root_url =/your/license/root/url

```

### Create Configmap for Grafana Enterprise configuration

Create a Kubernetes Configmap from your `grafana.ini` file with the following command:

```bash
kubectl create configmap ge-config --from-file=/path/to/your/grafana.ini
```

### Create Grafana Enterprise Kubernetes manifest

Create a `grafana.yaml` file, and copy-and-paste the following content into it.
The YAML that follows is identical to the one for a Grafana installation, except for the additional references to the Configmap that contains your Grafana configuration file and the secret that has your license.

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
              name: grafana-pv
            - mountPath: /etc/grafana
              name: ge-config
            - mountPath: /etc/grafana/license
              name: ge-license
      volumes:
        - name: grafana-pv
          persistentVolumeClaim:
            claimName: grafana-pvc
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

{{% admonition type="caution" %}}
If you use `LoadBalancer` in the Service and depending on your cloud platform and network configuration, doing so might expose your Grafana instance to the Internet. To eliminate this risk, use `ClusterIP` to restrict access from within the cluster Grafana is deployed to.
{{% /admonition %}}

1. Send manifest to Kubernetes API Server
   `kubectl apply -f grafana.yaml`

1. Check that it worked by running the following:
   `kubectl port-forward service/grafana 3000:3000`

1. Navigate to `localhost:3000` in your browser. You should see the Grafana login page.

1. Use `admin` for both the username and password to login.
   If it worked, you should see `Enterprise (Licensed)` at the bottom of the page.
