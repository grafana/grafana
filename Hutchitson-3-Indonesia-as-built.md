<center>
	<h1>
		<font color="#58585B">Cisco Advanced Services</font>
	</h1>
</center>

<p align="center">
	<img width="550" height="367" src="https://www.cisco.com/c/en/us/products/data-center-analytics/tetration-analytics/index/_jcr_content/Grid/category_atl/layout-category-atl/blade_8/bladeContents/thirds_0/Th-Third-3/tile_c109/image.img.jpg/1505974847528.jpg">
	<p align="center">
</p>

<center>
	<h1>
		<font color="#58585B">
			Cisco Tetration Analytics<br>
		</font>
	</h1>
	<h3>
		<font color="#58585B">
			Hutchitson 3 Indonesia<br>
			Cluster Configuration Information<br>
			March 12, 2019<br>
		</font>
	</h3>
</center>

<font color="#58585B">
Cisco Systems, Inc.<br>
Corporate Headquarters<br>
170 West Tasman Drive<br>
San Jose, CA 95134-1706 USA<br>
<a href="http://www.cisco.com">http://www.cisco.com</a><br>
Tel:  408 526-4000 | Toll Free: 800 553-NETS (6387)<br>
Fax:  408 526-4100<br>
</font>

<div style="page-break-after: always;"></div>

# Table of Contents

---

  * 1 **Document Information**
    * 1.1 Document History
  * 2 **Executive Summary**
  * 3 **Introduction**
    * 3.1 Preface
    * 3.2 Audience
    * 3.3 Scope
  * 4 **Sensor Deployment Overview**
    * 4.1 Sensor Connectivity
  * 5 **Tetration Analytics Cluster Details**
    * 5.1 Deployment Date
    * 5.2 Current Software Version
    * 5.3 Cluster Upgrade(s)
    * 5.4 Software Sensor Auto-Upgrade
    * 5.5 Message of the Day
    * 5.6 LDAP Configuration
    * 5.7 Site Information
    * 5.8 Cluster Nodes
    * 5.9 VRF(s)
    * 5.10 Scope(s)
    * 5.11 Interface Config Intents
    * 5.12 Software Sensor(s)
    * 5.13 Sensor Interface(s)
    * 5.14 Hardware Sensors
    * 5.15 Subnet(s)
    * 5.16 Collection Rules
    * 5.17 Filter(s)
    * 5.18 User Role(s)
    * 5.19 Role Capabilities
    * 5.20 User(s)
    * 5.21 Application Workspace(s)
    * 5.22 Application Clusters(s)
    * 5.23 Application Policies


<div style="page-break-after: always;"></div>

# 1 - Document Information

---

**Author**: Cisco Advanced Services

**Change Authority**: Cisco Advanced Services

**Document Version**: 1.0

## 1.1 - Document History
| Rev | Date | Originator | Status | Comment |
|---|---|---|---|---|
|<font color="black">1.0</font>|<font color="white"> xxxxxxxxxxxxxxxxxx</font>|<font color="black"> Cisco Advanced Services</font>|<font color="black"> Release</font>|<font color="black"> Initial release</font>|


<div style="page-break-after: always;"></div>

# 2 - Executive Summary

---

The project is driven by dynamically evolving requirements and the growing demand for visibility and security.

Cisco Tetration Analytics uses advanced big-data technology to address critical datacenter operational use cases and offers an application behavior based policy lifecycle management.

Cisco Tetration Analytics enables the administrator to gain pervasive visibility of traffic flows, in near real-time within your data center to address critical operational use cases. Modern data centers are very dynamic due to the virtualization, container adoption, and workload mobility. These factors are driving rapid application deployments and continually shifting communication patterns. This presents visibility, operational, and security challenges that require new capabilities to address. This dynamic shift attributes to three primary challenges:

 * Lack of visibility into application behavior and their dependencies

 * Inability to get to a zero-trust model using white-list policy for applications

 * Unable to perform compliance audit, identify deviations and deliver forensics

To address these challenges, Cisco has introduced Tetration Analytics, a platform that leverages advanced big-data technologies such as unsupervised machine learning, behavioral analysis and intelligent algorithms to provide a turnkey solution. This platform is designed to provide:

 * Pervasive visibility at line rate across all flows within datacenter

 * Complete view of an application and its behavior

 * Consistent whitelist policy lifecycle management to support today's data center infrastructure

By leveraging low overhead hardware and or software sensor, this solution is designed to support both brown field and green field data center infrastructure.

<div style="page-break-after: always;"></div>

# 3 - Introduction

---

## 3.1 - Preface

This document provides a formal report of the Tetration cluster being deployed within the Hutchitson 3 Indonesia data center(s). 

## 3.2 - Audience

This document is intended for use by the Hutchitson 3 Indonesia network, security, application, and operations teams, and the Cisco's Advanced Services team.

## 3.3 - Scope

This document provides information on technology and deployment of the Tetration cluster in the Hutchitson 3 Indonesia environment and describes the data collection services associated with the solution.

<div style="page-break-after: always;"></div>

# 4 - Sensor Deployment Overview

## 4.1 - Sensor Connectivity

Sensors communicate via IP to the Tetration collectors. Both hardware and software sensors accomplish this without impeding traffic and are not in the data path. Software sensors require TCP ports 443 and 5640/5660 for access to the collectors and hardware sensors utilize UDP.

| Type | Control-Plane | Visibility | Enforcement |
|:---:|:---:|:---:|:---:|
| Legacy Deep Visibility Agent | TCP/443 | TCP/5640 | - |
| Universal Visibility Agent | TCP/443 | TCP/5640 | - |
| Deep Visibility Agent | TCP/443 | TCP/5640 | - |
| Enforcement Agent | TCP/443 | TCP/5640 | TCP/5660 |
| Hardware Agent | TCP/443 | **UDP**/5640 | - |

<div style="page-break-after: always;"></div>

# 5 - Tetration Analytics Cluster Details

## 5.1 - Deployment Date

The **tetrahutch.three.co.id** Tetration cluster was deployed on **2018-11-22 08:48:25**

## 5.2 - Current Software Version

The **tetrahutch.three.co.id** Tetration cluster is running version: **3.1.1.53-PATCH-3.1.1.55**

## 5.3 - Cluster Upgrade(s)

The following upgrages have taken place on **tetrahutch.three.co.id** since it was initially deployed:

|id|start time|end time|rpms|status|
|---|---|---|---|---|
|1|2018-11-26 15:24:46.518314|2018-11-26 15:24:47.100274|[u'tetration\_os\_patch\_k9-2.3.1.52-1.noarch']|PASSED|
|2|2018-11-27 01:34:47.423336|2018-11-27 02:53:51.054147|[u'tetration\_os\_base\_rpm\_k9-3.1.1.53-1.el7.x86\_64', u'tetration\_os\_mother\_rpm\_k9-3.1.1.53-1.el6.x86\_64', u'tetration\_os\_qcow\_k9-3.1.1.53-1.x86\_64', u'tetration\_os\_rpminstall\_k9-3.1.1.53-1.noarch', u'tetration\_os\_UcsFirmware\_k9-3.1.1.53-1.x86\_64', u'tetration\_os\_adhoc\_k9-3.1.1.53-1.el6.x86\_64']|PASSED|
|3|2019-01-03 09:16:12.634497|2019-01-03 09:16:13.772245|[u'tetration\_os\_patch\_k9-3.1.1.55-1.noarch']|PASSED|


## 5.4 - Software Sensor Auto-Upgrade

Software Sensor Auto-Upgrade is **Enabled**.

## 5.5 - Message of the Day


```
The Message of the Day has not been configured.
```


## 5.6 - LDAP Configuration

| field | value |
|---|---
| **enabled** | null |
| **host** | None |
| **port** | None |
| **attribute** | mail |
| **base** | None |
| **admin_user** | None |
| **ssl** | True |


## 5.7 - Site Information

Tetration **Site Information** defines how the Tetration cluster has been deployed. The Site Information details can be referenced for the cluster connectivity to the data center network and for the initial configuration. This includes but is not limited to the uplinks from the Tetration cluster to the network infrastructure.

Some of this information may be changed only during a future upgrade. Please check the release notes for which fields may be changed.


Site Information for **tetrahutch.three.co.id**


```
site_cluster_type: PHYSICAL
site_leaf_1_ip: 10.1.146.162
site_name: tetrahutch
site_leaf_1_gateway: 10.1.146.161
site_smtp_username: 
site_syslog_server: 
cluster_uuid: d585a2fd-a558-6e8c-576d-d3ce9e508dda
site_leaf1_infra_ip: 5.5.5.252/31
site_spine_loopback_ip: 5.5.5.5/32
site_enable_strong_ciphers_sensor_vip: false
site_cimc_internal_network_gateway: 192.168.0.1
site_dns_resolvers: 10.101.32.88
site_smtp_port: 25
site_ui_admin_email: tetra-admin@three.co.id
site_syslog_port: 
site_interconnect_netmask: 255.255.255.252
site_dns_domain: hutch.co.id
site_bosun_email: tetra-alert@three.co.id
site_smtp_server: 10.101.33.7
site_internal_network: 1.1.0.0/17
site_leaf_2_interconnect_ip: 192.168.65.2
site_leaf2_infra_ip: 5.5.5.254/31
site_leaf_1_netmask: 255.255.255.252
site_cimc_internal_network: 192.168.0.0/24
site_ui_vip_vrid: 77
site_leaf_2_ip: 10.1.146.166
site_routable_network: 10.1.146.0/26
site_ntp_config_server: 10.0.7.32
site_leaf_1_interconnect_ip: 192.168.65.1
site_external_ips: 
site_leaf_2_netmask: 255.255.255.252
site_ui_fqdn: tetrahutch.three.co.id
site_leaf_2_gateway: 10.1.146.165
site_ui_primary_customer_support_email: tetra-support@three.co.id
site_sku: 8RU-PROD

```


## 5.8 - Cluster Nodes
The following physical (baremetal) nodes have been deployed within the **tetrahutch.three.co.id** Tetration Cluster. The physical nodes are used as hypervisor hosts for the Tetration solution. Each host supports one or more components.


### 5.8.1 - Cluster Nodes
|serial|sw version|status|state|inst deployed|cimc ip|switch port|
|---|---|---|---|---|---|---|
|FCH2226VFHG|3.1.1.53|Active|Commissioned|[u'orchestrator-1', u'namenode-1', u'appServer-2', u'datanode-5', u'redis-3', u'druidHistoricalBroker-3', u'collectorDatamover-5']|192.168.0.11|Ethernet1/1|
|FCH2226VFA4|3.1.1.53|Active|Commissioned|[u'adhocKafkaXL-1', u'happobat-1', u'orchestrator-2', u'elasticsearch-3', u'druidHistoricalBroker-4', u'secondaryNamenode-1', u'datanode-6', u'collectorDatamover-6']|192.168.0.12|Ethernet1/2|
|FCH2226VF8P|3.1.1.53|Active|Commissioned|[u'resourceManager-2', u'orchestrator-3', u'happobat-2', u'hbaseRegionServer-2', u'enforcementPolicyStore-3', u'datanode-1', u'enforcementCoordinator-1', u'druidHistoricalBroker-1', u'zookeeper-1', u'collectorDatamover-3']|192.168.0.13|Ethernet1/3|
|FCH2226VFNE|3.1.1.53|Active|Commissioned|[u'druidCoordinator-1', u'launcherHost-1', u'elasticsearch-1', u'mongodb-1', u'hbaseMaster-1', u'enforcementPolicyStore-1', u'enforcementCoordinator-2', u'adhoc-1', u'datanode-2', u'redis-1', u'zookeeper-2', u'tsdbBosunGrafana-1', u'collectorDatamover-1']|192.168.0.14|Ethernet1/4|
|FCH2226VFNC|3.1.1.53|Active|Commissioned|[u'druidCoordinator-2', u'launcherHost-2', u'zookeeper-3', u'hbaseMaster-2', u'enforcementPolicyStore-2', u'elasticsearch-2', u'enforcementCoordinator-3', u'adhoc-2', u'datanode-3', u'mongodb-2', u'redis-2', u'tsdbBosunGrafana-2', u'collectorDatamover-2']|192.168.0.15|Ethernet1/5|
|FCH2226VF87|3.1.1.53|Active|Commissioned|[u'resourceManager-1', u'datanode-4', u'mongodbArbiter-1', u'hbaseRegionServer-1', u'launcherHost-3', u'druidHistoricalBroker-2', u'collectorDatamover-4', u'appServer-1']|192.168.0.16|Ethernet1/6|


## 5.9 - VRF(s)

Configure this feature to map multiple hardware (switch) **VRFs** to one Tetration Root Scope/VRF. Tetration's ingest data path (collectors) will map the hardware VRFs to the one Tetration VRF. Using Tetration user defined Tenants/VRFs client networks can be modeled within Tetration.

The table(s) below lists the VRFs defined within the Tetration cluster, **tetrahutch.three.co.id**.


### 5.9.1 - VRFs
|tenant name|name|vrf id|
|---|---|---|
|676769|TN-H3I-DC|676769|
|676770|TN-H3I-ENV|676770|
|Default|Unknown|0|
|Default|Default|1|
|Tetration|Tetration|676767|


## 5.10 - Scope(s)

Tetration **Scopes** create boundaries for creating Application Workspaces. As the overall Scope definitions are defined, a suggestion is to relate scopes not only to the Application boundaries but also to potential Role Based Access Control, RBAC. This forward thinking will allow the Tetration infrastructure to manage user access based on desired Application access.

The table(s) below depict the deployed Scopes within the Tetration cluster, **tetrahutch.three.co.id**.


### 5.10.1 - Unknown Scope
```
Unknown
```
|name|short query|
|---|---|
|Unknown|{u'field': u'vrf\_id', u'type': u'eq', u'value': 0}|

### 5.10.2 - Default Scope
```
Default
```
|name|short query|
|---|---|
|Default|{u'field': u'vrf\_id', u'type': u'eq', u'value': 1}|

### 5.10.3 - TN-H3I-ENV Scope
```
TN-H3I-ENV
```
|name|short query|
|---|---|
|TN-H3I-ENV|{u'field': u'vrf\_id', u'type': u'eq', u'value': 676770}|

### 5.10.4 - TN-H3I-DC Scope
```
TN-H3I-DC (754)
    |-- VAS (3)
    |-- TIBCO (34)
    |-- Intec SV (9)
    |-- BCV (8)
    |-- HP-MGMT (7)
    |-- QRMAP
    |-- VMS
    |-- NOTIFICATION (8)
    |-- ETL (8)
    |-- ESX (49)
    |-- Comptel (30)
    |-- EMC (4)
    |-- Windows Domain (1)
    |-- Exchange (6)
    |-- File Server (1)
    |-- SiteMS (3)
    |-- DWH (29)
    |-- DID (3)
    |-- EMS (24)
    |-- Batch Mediation
    |-- CRM (12)
    |-- Pretups (34)
    |-- ICT (13)
    |-- Bimatri (39)
    |-- Backup (29)
    |-- NG (37)
    |-- LMS (60)
    |-- NG2 (9)
    |-- Greenplum (31)
    |-- OCC (11)
    |-- TrendApp (19)
    |-- ODS (16)
    |-- Taxation Server
    |-- DCA (18)
    |-- BILLING (151)
    |-- POSS (3)
    |-- CWX (5)
    |-- SELFCARE (16)
    |-- ERP (28)
    |-- USSD (5)
    |-- SMSC (22)
```
|name|short query|
|---|---|
|BCV|{u'field': u'user\_Application', u'type': u'eq', u'value': u'BCV'}|
|BILLING|{u'type': u'or', u'filters': [{u'field': u'user\_Rackname', u'type': u'contains', u'value': u'Bill'}, {u'field': u'user\_Application', u'type': u'contains', u'value': u'SV10'}, {u'field': u'user\_Description', u'type': u'contains', u'value': u'SV10'}]}|
|Backup|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Backup'}|
|Batch Mediation|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Batch Mediation'}|
|Bimatri|{u'field': u'user\_Description', u'type': u'contains', u'value': u'Bima'}|
|CRM|{u'field': u'user\_Application', u'type': u'eq', u'value': u'CRM'}|
|CWX|{u'field': u'user\_Application', u'type': u'eq', u'value': u'CWX'}|
|Comptel|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Comptel'}|
|DCA|{u'field': u'user\_Server Type', u'type': u'eq', u'value': u'DCA'}|
|DID|{u'field': u'user\_Application', u'type': u'eq', u'value': u'DID'}|
|DWH|{u'field': u'user\_Application', u'type': u'eq', u'value': u'DWH'}|
|EMC|{u'field': u'user\_Application', u'type': u'eq', u'value': u'EMC'}|
|EMS|{u'type': u'or', u'filters': [{u'field': u'user\_Application', u'type': u'eq', u'value': u'EMS'}, {u'field': u'user\_Description', u'type': u'contains', u'value': u'EMS'}]}|
|ERP|{u'field': u'user\_Application', u'type': u'eq', u'value': u'ERP'}|
|ESX|{u'field': u'user\_Application', u'type': u'eq', u'value': u'ESX'}|
|ETL|{u'field': u'user\_Application', u'type': u'eq', u'value': u'ETL'}|
|Exchange|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Exchange'}|
|File Server|{u'field': u'user\_Application', u'type': u'eq', u'value': u'File Server'}|
|Greenplum|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Greenplum'}|
|HP-MGMT|{u'field': u'user\_Application', u'type': u'eq', u'value': u'HP-MGMT'}|
|ICT|{u'field': u'user\_Application', u'type': u'eq', u'value': u'ICT'}|
|Intec SV|{u'field': u'user\_Application', u'type': u'eq', u'value': u'INTEC SV'}|
|LMS|{u'field': u'user\_Application', u'type': u'eq', u'value': u'LMS'}|
|NG|{u'field': u'user\_Application', u'type': u'eq', u'value': u'NG'}|
|NG2|{u'field': u'user\_Application', u'type': u'eq', u'value': u'NG2'}|
|NOTIFICATION|{u'field': u'user\_Application', u'type': u'eq', u'value': u'NOTIFICATION'}|
|OCC|{u'field': u'user\_Application', u'type': u'eq', u'value': u'OCC'}|
|ODS|{u'field': u'user\_Application', u'type': u'eq', u'value': u'ODS'}|
|POSS|{u'type': u'or', u'filters': [{u'field': u'user\_Application', u'type': u'eq', u'value': u'POSS'}, {u'type': u'and', u'filters': [{u'field': u'user\_Description', u'type': u'contains', u'value': u'POSS'}, {u'field': u'user\_Hostname', u'type': u'contains', u'value': u'POSS'}]}]}|
|Pretups|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Pretups'}|
|QRMAP|{u'field': u'user\_Application', u'type': u'eq', u'value': u'QRMAP'}|
|SELFCARE|{u'field': u'user\_Application', u'type': u'eq', u'value': u'SelfCare'}|
|SMSC|{u'field': u'user\_Rackname', u'type': u'eq', u'value': u'SMSC'}|
|SiteMS|{u'field': u'user\_Application', u'type': u'eq', u'value': u'SiteMS'}|
|TIBCO|{u'field': u'user\_Application', u'type': u'eq', u'value': u'TIBCO'}|
|TN-H3I-DC|{u'field': u'vrf\_id', u'type': u'eq', u'value': 676769}|
|Taxation Server|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Taxation Server '}|
|TrendApp|{u'field': u'user\_Application', u'type': u'eq', u'value': u'TrendApp'}|
|USSD|{u'field': u'user\_Rackname', u'type': u'eq', u'value': u'USSD'}|
|VAS|{u'field': u'user\_Description', u'type': u'contains', u'value': u'VAS'}|
|VMS|{u'field': u'user\_Application', u'type': u'eq', u'value': u'VMS'}|
|Windows Domain|{u'field': u'user\_Application', u'type': u'eq', u'value': u'Windows Domain'}|

### 5.10.5 - Tetration Scope
```
Tetration (61)
    |-- Adhoc (5)
    |    |-- AdhocKafka (1)
    |    |-- AdhocServers (4)
    |-- FrontEnd (12)
    |    |-- ElasticSearch (3)
    |    |-- Redis (3)
    |    |-- Mongo (3)
    |    |    |-- MongoServer (2)
    |    |    |-- MongoDBArbiter (1)
    |-- Compute (10)
    |    |-- HDFS (8)
    |    |    |-- Datanodes (6)
    |    |    |-- Namenodes (2)
    |    |    |    |-- PrimaryNamenode (2)
    |    |    |    |-- SecondaryNamenode (1)
    |    |-- YARN (2)
    |    |    |-- Nodemanagers
    |    |    |-- ResourceManagers (2)
    |-- Serving Layer (6)
    |    |-- Coordinators (2)
    |    |-- HistoricalsAndBrokers (4)
    |-- Infrastructure (16)
    |    |-- Monitoring (6)
    |    |    |-- TSDB (2)
    |    |    |-- HBase (4)
    |    |-- Launchers (3)
    |    |-- DistributedCoordinators (7)
    |    |    |-- ZooKeeper (3)
    |    |    |-- Orchestrator (4)
    |    |-- HAProxyPostGresAMSBatchMover
    |-- Enforcement (6)
    |    |-- EnforcementCoordinator (3)
    |    |-- EnforcementPolicyStore (3)
    |-- Collector (6)
```
|name|short query|
|---|---|
|Adhoc|{u'field': u'host\_name', u'type': u'contains', u'value': u'adhoc'}|
|AdhocKafka|{u'field': u'host\_name', u'type': u'contains', u'value': u'adhocKafka'}|
|AdhocServers|{u'field': u'host\_name', u'type': u'contains', u'value': u'adhoc-'}|
|Collector|{u'field': u'host\_name', u'type': u'contains', u'value': u'collector'}|
|Compute|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'datanode'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'nodemana'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'namenode'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'secondaryNamenode'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'resourceManager'}]}|
|Coordinators|{u'field': u'host\_name', u'type': u'contains', u'value': u'druidCo'}|
|Datanodes|{u'field': u'host\_name', u'type': u'contains', u'value': u'datanode'}|
|DistributedCoordinators|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'zoo'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'orch'}]}|
|ElasticSearch|{u'field': u'host\_name', u'type': u'contains', u'value': u'elastic'}|
|Enforcement|{u'field': u'host\_name', u'type': u'contains', u'value': u'enforcement'}|
|EnforcementCoordinator|{u'field': u'host\_name', u'type': u'contains', u'value': u'enforcementCo'}|
|EnforcementPolicyStore|{u'field': u'host\_name', u'type': u'contains', u'value': u'enforcementPolicy'}|
|FrontEnd|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'appServer'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'elastic'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'redis'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'mongo'}]}|
|HAProxyPostGresAMSBatchMover|{u'field': u'host\_name', u'type': u'contains', u'value': u'happo'}|
|HBase|{u'field': u'host\_name', u'type': u'contains', u'value': u'hbase'}|
|HDFS|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'datanode'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'namenode'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'secondaryNamenode'}]}|
|HistoricalsAndBrokers|{u'field': u'host\_name', u'type': u'contains', u'value': u'druidHis'}|
|Infrastructure|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'zoo'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'orch'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'launch'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'happo'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'tsdb'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'hbase'}]}|
|Launchers|{u'field': u'host\_name', u'type': u'contains', u'value': u'launcher'}|
|Mongo|{u'field': u'host\_name', u'type': u'contains', u'value': u'mongo'}|
|MongoDBArbiter|{u'field': u'host\_name', u'type': u'contains', u'value': u'mongodbAr'}|
|MongoServer|{u'field': u'host\_name', u'type': u'contains', u'value': u'mongodb-'}|
|Monitoring|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'tsdb'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'hbase'}]}|
|Namenodes|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'namenode'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'secondaryNamenode'}]}|
|Nodemanagers|{u'field': u'host\_name', u'type': u'contains', u'value': u'nodemanagers'}|
|Orchestrator|{u'field': u'host\_name', u'type': u'contains', u'value': u'orch'}|
|PrimaryNamenode|{u'field': u'host\_name', u'type': u'contains', u'value': u'namenode'}|
|Redis|{u'field': u'host\_name', u'type': u'contains', u'value': u'redis'}|
|ResourceManagers|{u'field': u'host\_name', u'type': u'contains', u'value': u'resourceManager'}|
|SecondaryNamenode|{u'field': u'host\_name', u'type': u'contains', u'value': u'secondaryNamenode'}|
|Serving Layer|{u'field': u'host\_name', u'type': u'contains', u'value': u'druid'}|
|TSDB|{u'field': u'host\_name', u'type': u'contains', u'value': u'tsdb'}|
|Tetration|{u'field': u'vrf\_id', u'type': u'eq', u'value': 676767}|
|YARN|{u'type': u'or', u'filters': [{u'field': u'host\_name', u'type': u'contains', u'value': u'nodemanager'}, {u'field': u'host\_name', u'type': u'contains', u'value': u'resourceManager'}]}|
|ZooKeeper|{u'field': u'host\_name', u'type': u'contains', u'value': u'zoo'}|


## 5.11 - Interface Config Intents

 0. Apply VRF **TN-H3I-DC** to AppScope **Default** if endpoints are in **Any**
 0. Apply VRF **TN-H3I-DC** to UserInventoryFilter **Everything** if endpoints are in **Any**


## 5.12 - Software Sensor(s)

**Software sensors**, often referred to as **software agents**, are one mechanism for providing flow visibility into Application behavior. Agents are directly downloaded from the cluster and installed within the guest operating systems. Software sensors capture meta data related to each flow observed within the OS as well process information. This data is then consolidated and presented to the Tetration cluster every second.

The table(s) below depict the deployed Sensors (agents) within the Tetration cluster, **tetrahutch.three.co.id**. 

output/sensors.csv

## 5.13 - Sensor Interface(s)

As a function of the agent it will collect details related to the **interfaces** currently deployed on the host. The interfaces define the boundary of the data collected within the agent. Each interface, IPv4 or IPv6, is considered a separate endpoint for policy discovery.

The table(s) below depict the discovered Sensors Interfaces within the hosts within the Tetration cluster, **tetrahutch.three.co.id**.

output/sensor_interfaces.csv

## 5.14 - Hardware Sensors

**Hardware sensors**, like software sensors, are a mechanism for providing flow visibility into Application behavior. Hardware sensors are deployed in the Nexus 9K switches and implemented in hardware. These sensors can be deployed in ACI or NXOS fabrics. **Hardware sensors** can only provide visibility into flows observed on the network and do not provide metadata related to the user, process, or binary associated with a flow unless that flow is also observed by a software sensor.

The table(s) below depict the deployed Hardware Sensors (agents) within the Tetration cluster, **tetrahutch.three.co.id**. 


### 5.14.1 - Hardware Sensors
|name|serial|ip|nxos version|agent version|
|---|---|---|---|---|
|MM-LB0101|FDO22292NCA|10.4.48.10|n9000-13.2(2o)|3.1.1.53|
|MM-LB0102|FDO22292N0U|10.4.48.11|n9000-13.2(2o)|3.1.1.53|
|MM-LB0103|FDO2229177E|10.4.48.12|n9000-13.2(2o)|3.1.1.53|
|MM-LB0104|FDO22293MHM|10.4.48.13|n9000-13.2(2o)|3.1.1.53|
|MM-LC0105|FDO22292N2U|10.4.48.14|n9000-13.2(2o)|3.1.1.53|
|MM-LC0106|FDO222916ZJ|10.4.48.15|n9000-13.2(2o)|3.1.1.53|
|MM-LC0107|FDO22293MQU|10.4.48.16|n9000-13.2(2o)|3.1.1.53|
|MM-LC0108|FDO22293MHB|10.4.48.17|n9000-13.2(2o)|3.1.1.53|
|MM-LC0109|FDO22293MQT|10.4.48.18|n9000-13.2(2o)|3.1.1.53|
|MM-LC0110|FDO222937X6|10.4.48.19|n9000-13.2(2o)|3.1.1.53|
|MM-LC0111|FDO2230036P|10.4.48.20|n9000-13.2(2o)|3.1.1.53|
|MM-LC0112|FDO22292MW7|10.4.48.21|n9000-13.2(2o)|3.1.1.53|
|MM-LC0113|FDO22292MJV|10.4.48.22|n9000-13.2(2o)|3.1.1.53|
|MM-LC0114|FDO22300372|10.4.48.23|n9000-13.2(2o)|3.1.1.53|
|MM-LC0115|FDO22292MFQ|10.4.48.24|n9000-13.2(2o)|3.1.1.53|
|MM-LC0116|FDO223007KQ|10.4.48.25|n9000-13.2(2o)|3.1.1.53|
|MM-LC0117|FDO22292NB4|10.4.48.26|n9000-13.2(2o)|3.1.1.53|
|MM-LC0118|FDO22292MJX|10.4.48.27|n9000-13.2(2o)|3.1.1.53|
|MM-LC0119|FDO22292MWQ|10.4.48.28|n9000-13.2(2o)|3.1.1.53|
|MM-LC0120|FDO222916ZM|10.4.48.29|n9000-13.2(2o)|3.1.1.53|
|MM-LC0121|FDO22292MJQ|10.4.48.30|n9000-13.2(2o)|3.1.1.53|
|MM-LC0122|FDO2230036Q|10.4.48.31|n9000-13.2(2o)|3.1.1.53|
|MM-LC0123|FDO22293ML5|10.4.48.32|n9000-13.2(2o)|3.1.1.53|
|MM-LC0124|FDO223007KG|10.4.48.33|n9000-13.2(2o)|3.1.1.53|
|MM-LC0125|FDO22292NAP|10.4.48.34|n9000-13.2(2o)|3.1.1.53|
|MM-LC0126|FDO2229171K|10.4.48.35|n9000-13.2(2o)|3.1.1.53|
|MM-LC0127|FDO22293MHG|10.4.48.36|n9000-13.2(2o)|3.1.1.53|
|MM-LC0128|FDO22292ND8|10.4.48.37|n9000-13.2(2o)|3.1.1.53|
|MM-LC0129|FDO22292MLK|10.4.48.38|n9000-13.2(2o)|3.1.1.53|
|MM-LC0130|FDO22293MSC|10.4.48.39|n9000-13.2(2o)|3.1.1.53|
|MM-LC0131|FDO22293MSH|10.4.48.40|n9000-13.2(2o)|3.1.1.53|
|MM-LC0132|FDO22292NBN|10.4.48.41|n9000-13.2(2o)|3.1.1.53|
|MM-LC0133|FDO22292N15|10.4.48.42|n9000-13.2(2o)|3.1.1.53|
|MM-LC0134|FDO223007J0|10.4.48.43|n9000-13.2(2o)|3.1.1.53|
|MM-LC0135|FDO223007JJ|10.4.48.44|n9000-13.2(2o)|3.1.1.53|
|MM-LC0136|FDO22292ND6|10.4.48.45|n9000-13.2(2o)|3.1.1.53|
|MM-LC0137|FDO22292NB9|10.4.48.46|n9000-13.2(2o)|3.1.1.53|
|MM-LC0138|FDO2229386W|10.4.48.47|n9000-13.2(2o)|3.1.1.53|
|MM-SP1101|FGE22294RNV|10.4.48.4|n9000-13.2(2o)|3.1.1.53|
|MM-SP1102|FGE22294RN4|10.4.48.5|n9000-13.2(2o)|3.1.1.53|


## 5.15 - Subnet(s)

Tetration agents deployed throughout the network communicate with the cluster via IPv4 addresses as assigned to the guest OS. Often it is necessary to determine what IPv4 **subnets** are communicating within the network as well as understanding where within the network Tetration agents are deployed.

The table(s) below document the subnets discovered in the Tetration cluster, **tetrahutch.three.co.id**. 

**add a table describing the columns for the subnet table**

output/subnets.csv

## 5.16 - Collection Rules

**Collection rules** define the subnets/addresses that are considered 'internal' to the Tetration cluster as stored in inventory. With the wide range of networks learned in the growing networks, Collection Rules provide a mechanism for limiting what Tetration considers an 'internal' inventory item.

The table(s) below defines the list of subnets and the priority that make up the Collection rules in the Tetration cluster, **tetrahutch.three.co.id**.. 


### 5.16.1 - Collection Rules: ```Default```
|subnet|priority|action|
|---|---|---|
|0.0.0.0/0|0|INCLUDE|
|::/0|1|INCLUDE|

### 5.16.2 - Collection Rules: ```Unknown```
|subnet|priority|action|
|---|---|---|
|0.0.0.0/0|0|INCLUDE|
|::/0|1|INCLUDE|

### 5.16.3 - Collection Rules: ```TN-H3I-ENV```
|subnet|priority|action|
|---|---|---|
|0.0.0.0/0|0|INCLUDE|
|::/0|1|INCLUDE|

### 5.16.4 - Collection Rules: ```Tetration```
|subnet|priority|action|
|---|---|---|
|0.0.0.0/0|0|INCLUDE|
|::/0|1|INCLUDE|

### 5.16.5 - Collection Rules: ```TN-H3I-DC```
|subnet|priority|action|
|---|---|---|
|0.0.0.0/0|0|INCLUDE|
|::/0|1|INCLUDE|


## 5.17 - Filter(s)

**Filters** provide a mechanism for creating and saving user defined queries. The filters can then be utilized to search within the Tetration cluster to manage the specified devices. The user created filters can be used to validate host annotations as well as identify manage host attributes.

The table(s) below list the configured filters within the Tetration cluster, **tetrahutch.three.co.id**.


### 5.17.1 - Filters
|name|short query|filter type|scope|
|---|---|---|---|
|Everything|{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'subnet', u'value': u'0.0.0.0/0'}, {u'field': u'ip', u'type': u'subnet', u'value': u'::/0'}]}|UserInventoryFilter||
|FltTibco|{u'field': u'user\_Application', u'type': u'eq', u'value': u'tibco'}|UserInventoryFilter|TN-H3I-DC|


## 5.18 - User Role(s)

**User Roles** define how users interact with the Tetration cluster. Roles contain sets of Capabilities and are assigned to users. A user can have any number of roles with any number of capabilities. This mechanism provides a means to managing users tasks such as but not limited to read only or host level policy enforcement.

The table(s) below list the user roles within the Tetration cluster, **tetrahutch.three.co.id**. 


### 5.18.1 - User Roles
|name|description|scope|
|---|---|---|
|Customer Support|Technical Support or Advanced Services||
|Global Application Enforcement|Enforce application policies on the network.||
|Global Application Management|Read and write all application workspaces.||
|Global Read Only|Read workspaces and flows for all scopes.||
|Site Admin|Admin has the ability to manage users, sensors, etc.||


## 5.19 - Role Capabilities

User **Role Capabilities** define how users interact with the Tetration cluster. Roles contain sets of Capabilities and are assigned to users. A user can have any number of roles with any number of capabilities. This mechanism provides a means to managing users tasks such as but not limited to read only or host level policy enforcement.

The table(s) below list the user defined roles within the Tetration cluster, **tetrahutch.three.co.id**.


### 5.19.1 - Role Capability ```Customer Support```
|ability|scope|inherited|
|---|---|---|
|SCOPE\_OWNER||False|

### 5.19.2 - Role Capability ```Global Application Enforcement```
|ability|scope|inherited|
|---|---|---|
|ENFORCE||False|

### 5.19.3 - Role Capability ```Site Admin```
|ability|scope|inherited|
|---|---|---|
|SCOPE\_OWNER||False|

### 5.19.4 - Role Capability ```Global Application Management```
|ability|scope|inherited|
|---|---|---|
|EXECUTE||False|

### 5.19.5 - Role Capability ```Global Read Only```
|ability|scope|inherited|
|---|---|---|
|SCOPE\_READ||False|


## 5.20 - User(s)

**Users** defined with in the Tetration cluster have access to operate and manage the environment. User access is controlled by Tetration admin created accounts based on individual email addresses. Once access has been established, the user can then manage the account within the UI and initiate password resets directly within the logon page.

The table(s) below list the user defined user accounts with access to the Tetration cluster, **tetrahutch.three.co.id**. 


### 5.20.1 - Users
|first name|last name|email|scope|roles|
|---|---|---|---|---|
|IT|Operations|it.operation@three.co.id||Global Read Only|
|Jefri|Abdullah|jeabdull@cisco.com||Customer Support, Site Admin|
|Muhamad Dicki|Setiawan|muhamad.setiawan@multipolar.com||Customer Support, Site Admin|
|Rachmat|Agung|rachmat.agung@multipolar.com||Global Read Only|
|Site|Admin|ony.darmawan@three.co.id||Site Admin, Customer Support|
|Site|Admin|tetra-admin@three.co.id||Site Admin|
|Sudhir|Harikant|suharika@cisco.com||Site Admin|


## 5.21 - Application Workspace(s)

**Application workspaces** define the framework for application dependency mapping for a given application. Application workspaces represent the collaborative environment for discovering and mapping application behavior. This application behavior may then be used to define the policy for the application workspace. 

The table(s) below list the defined Application Workspaces within the Tetration cluster, **tetrahutch.three.co.id**.


### 5.21.1 - Application Workspaces
|name|description|author|enforcement enabled|primary|version|scope|
|---|---|---|---|---|---|---|
|Billing|Billing Apps Scope|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:BILLING|
|Bimatri|H3i Bimatri|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:Bimatri|
|COMPTEL|H3I COMPTEL|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:Comptel|
|CRM|H3i CRM|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:CRM|
|CWX|H3I CWX|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:CWX|
|DWH|H3I DWH|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:DWH|
|EMS|H3i EMS|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:EMS|
|ERP|H3I ERP|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:ERP|
|ETL|H3I ETL|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:ETL|
|EXCHANGE|H3I Exchange|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:Exchange|
|File Server|H3I File Server|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:File Server|
|NG2|H3I NG2|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:NG2|
|POSS|H3I POSS|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:POSS|
|TIBCO|None|Site Admin|False|False|null|TN-H3I-DC:TIBCO|
|Test|None|Site Admin|False|False|null|Tetration|
|VAS|H3I VAS|Muhamad Dicki Setiawan|False|False|null|TN-H3I-DC:VAS|


## 5.22 - Application Clusters(s)

**Application clusters** are can be either derived via the Tetration algorithm or user defined. Application clusters define the application tiers or groupings that represent application behavior. Clusters are intended to group like hosts based on flows/process discovered during the ADM.

The table(s) below list the Application Clusters part of the Tetration cluster, **tetrahutch.three.co.id**.


### 5.22.1 - Application Cluster ```CWX-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.0.148.86|10.0.148.86|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.0.148.86'}]}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'user_Tier', u'type': u'contains', u'value': u'DB'}, {u'field': u'user_DC', u'type': u'eq', u'value': u'MM'}, {u'field': u'user_isCluster', u'type': u'eq', u'value': u'No'}, {u'field': u'user_Application', u'type': u'contains', u'value': u'CWX'}, {u'field': u'user_DC', u'type': u'contains', u'value': u'MM'}, {u'field': u'user_Tier Type', u'type': u'contains', u'value': u'Tier 3'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.0.148.86'}, {u'field': u'user_isPRODUCTION', u'type': u'contains', u'value': u'Prod'}, {u'field': u'user_Application', u'type': u'eq', u'value': u'CWX'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'405'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth0'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'CWX DB Server'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMCWXDB01'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.0.148.86'}, {u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 3'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'CWX DB Server'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'405'}, {u'field': u'user_isPRODUCTION', u'type': u'eq', u'value': u'Prod'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'BL460c G9'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMCWXDB01'}, {u'field': u'user_isCluster', u'type': u'contains', u'value': u'No'}, {u'field': u'user_Tier', u'type': u'eq', u'value': u'DB'}]```

### 5.22.2 - Application Cluster ```ERP-APP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.4.132|10.64.4.132|
|10.64.4.133|10.64.4.133|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.132'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.133'}]}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'ORAPRD0'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.13'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'ERP APP PRODUCTION SERVER '}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'DL380p G9'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL380p G9'}, {u'type': u'and', u'filters': [{u'field': u'user_isCluster', u'type': u'eq', u'value': u'Yes'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'ORAPRD0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Rackname', u'type': u'contains', u'value': u'HPR-02'}, {u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Rackname', u'type': u'contains', u'value': u'HPR-02'}, {u'field': u'user_isCluster', u'type': u'eq', u'value': u'Yes'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.13'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'ORAPRD0'}]}]```

### 5.22.3 - Application Cluster ```ERP-APP-DEV``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.12.19|10.64.12.19|
|10.64.44.4|10.64.44.4|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.12.19'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.44.4'}]}, {u'field': u'user_isPRODUCTION', u'type': u'eq', u'value': u'Non-Prod'}, {u'field': u'user_isPRODUCTION', u'type': u'contains', u'value': u'Non-Prod'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'P DEV'}]```

### 5.22.4 - Application Cluster ```ERP-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.4.217|10.64.4.217|
|10.64.4.48|10.64.4.48|
|10.64.4.50|10.64.4.50|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.48'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.50'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.217'}]}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan900:80'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.48'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900:801'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900:801'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900:802'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan2'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan900:80'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan2'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900:801'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900:802'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.48'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900:801'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.50'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan900:80'}]}]}]```

### 5.22.5 - Application Cluster ```ERP-DB-BACKUP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.8.69|10.64.8.69|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.8.69'}]}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.8.69'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.8.69'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan1'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'erpdb02'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan1'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'erpdb02'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.8.69'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan1'}]}]```

### 5.22.6 - Application Cluster ```ERP-DB-BACKUP2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.8.71|10.64.8.71|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.8.71'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.8.71'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.8.71'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan1'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'ERP DATABASE PRODUCTION SERVER #1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.8.71'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'lan1'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'erpdb01'}]}]```

### 5.22.7 - Application Cluster ```ERP-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.4.47|10.64.4.47|
|10.64.4.49|10.64.4.49|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.47'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.4.49'}]}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.47'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.4'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.47'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.49'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.4'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.47'}, {u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'erpdb01'}, u'type': u'not'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.4'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.47'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'erpdb02'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.4'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'erpdb02'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan900'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.4.4'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.4.47'}, {u'filter': {u'field': u'user_Description', u'type': u'eq', u'value': u'ERP DATABASE PRODUCTION SERVER #1'}, u'type': u'not'}]}]}]```

### 5.22.8 - Application Cluster ```EMS-APP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.32.87|10.64.32.87|
|10.64.32.88|10.64.32.88|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.32.87'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.32.88'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.32.8'}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMPEMSAPP0'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.32.8'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}]}]```

### 5.22.9 - Application Cluster ```EMS-APP-BACKUP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.28.185|10.64.28.185|
|10.64.28.186|10.64.28.186|
|10.64.29.89|10.64.29.89|
|10.64.29.93|10.64.29.93|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.185'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.186'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.89'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.93'}]}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth4'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth4'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Backup'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond2'}]}, {u'type': u'and', u'filters': [{u'field': u'user_isCluster', u'type': u'eq', u'value': u'No'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond2'}]}]```

### 5.22.10 - Application Cluster ```EMS-APP2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.32.10|10.64.32.10|
|10.64.32.11|10.64.32.11|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.32.10'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.32.11'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.32.1'}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'420'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'BL460c G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'420'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpemsapp0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpemsapp0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'420'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'BL460c G10'}]}]```

### 5.22.11 - Application Cluster ```EMS-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.25|10.64.16.25|
|10.64.16.26|10.64.16.26|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.25'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.26'}]}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth1'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth1'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.16.2'}]```

### 5.22.12 - Application Cluster ```EMS-DB-INTERCONNECT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|192.168.0.98|192.168.0.98|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.98'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.98'}, {u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.98'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.98'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.98'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'EMS DB Server 1'}]}]```

### 5.22.13 - Application Cluster ```EMS-DB-INTERCONNECT2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|192.168.0.99|192.168.0.99|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.99'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.99'}, {u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.99'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb02'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.99'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.99'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}]}]```

### 5.22.14 - Application Cluster ```EMS-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.25.29|10.64.25.29|
|10.64.25.30|10.64.25.30|
|10.64.25.46|10.64.25.46|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.29'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.30'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.46'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'EMS DB Server 1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'EMS DB Server 1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'EMS DB Server 1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth5'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth5'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'EMS DB Server 1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'EMS DB Server 1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth5'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'EMS DB Server 1'}]}]```

### 5.22.15 - Application Cluster ```EMS-DB3``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.25.44|10.64.25.44|
|10.64.25.45|10.64.25.45|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.44'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.45'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb02'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.4'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'EMS DB Server 2'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.4'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb02'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.4'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'EMS DB Server 2'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpehfdb02'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpehfdb02'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpehfdb02'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.4'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpehfdb02'}]}]```

### 5.22.16 - Application Cluster ```EMS-MGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.17.15|10.64.17.15|
|10.64.18.57|10.64.18.57|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.17.15'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.57'}]}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth0'}, {u'type': u'and', u'filters': [{u'field': u'user_isCluster', u'type': u'eq', u'value': u'No'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}]```

### 5.22.17 - Application Cluster ```VAS-SIT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.0.148.62|10.0.148.62|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.0.148.62'}]}, {u'field': u'user_Application', u'type': u'contains', u'value': u'MMVCSA02'}, {u'field': u'user_Rackname', u'type': u'contains', u'value': u'OPN-6'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.0.148.62'}, {u'field': u'user_DC', u'type': u'contains', u'value': u'MM'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}, {u'field': u'user_Tier Type', u'type': u'contains', u'value': u'Tier 3'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmsitdbvl01'}, {u'field': u'user_isCluster', u'type': u'eq', u'value': u'Yes'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.0.148.62'}, {u'field': u'user_isPRODUCTION', u'type': u'contains', u'value': u'Non-prod'}, {u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 3'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'405'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth0'}, {u'field': u'user_DC', u'type': u'eq', u'value': u'MM'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'VAS SIT Server'}, {u'field': u'user_Application', u'type': u'eq', u'value': u'MMVCSA02'}, {u'field': u'user_Tier', u'type': u'contains', u'value': u'APP/DB'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'405'}, {u'field': u'user_isPRODUCTION', u'type': u'eq', u'value': u'Non-prod'}, {u'field': u'user_Rackname', u'type': u'eq', u'value': u'OPN-6'}, {u'field': u'user_Tier', u'type': u'eq', u'value': u'APP/DB'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'VAS SIT Server'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'BL460c G9'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmsitdbvl01'}, {u'field': u'user_isCluster', u'type': u'contains', u'value': u'Yes'}]```

### 5.22.18 - Application Cluster ```DWH-APP-BACKUP``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.64.29.70|10.64.29.70|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.70'}]}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet2'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.29.70'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.29.70'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Backup'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'Ethernet2'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet2'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'DWH BO'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.29.70'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpbo01'}]}]```

### 5.22.19 - Application Cluster ```DWH-BO``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.64.25.83|10.64.25.83|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.83'}]}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.83'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet0'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.83'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'Ethernet0'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.25.83'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpbo01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'DWH BO'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}]}]```

### 5.22.20 - Application Cluster ```DWH-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|172.28.8.1|172.28.8.1|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'172.28.8.1'}]}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'FC6GP130900140'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'sdw1'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'SDW1(DCA)'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'sdw1'}, {u'field': u'host_name', u'type': u'contains', u'value': u'172.28.8.1'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'SDW1(DCA)'}, {u'field': u'user_Server SN', u'type': u'eq', u'value': u'FC6GP130900140'}, {u'field': u'host_name', u'type': u'eq', u'value': u'172.28.8.1'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 2'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}, {u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 2'}]}]```

### 5.22.21 - Application Cluster ```DWH-MANAGEMENT``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.64.19.230|10.64.19.230|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.230'}]}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet1'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.19.230'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'Ethernet1'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.19.230'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.19.230'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpbo01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'DWH BO'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}]}]```

### 5.22.22 - Application Cluster ```DWH-MDW``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.70.10.10|10.70.10.10|
|10.70.10.22|10.70.10.22|
|10.70.10.25|10.70.10.25|
|10.70.10.9|10.70.10.9|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.70.10.9'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.70.10.10'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.70.10.22'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.70.10.25'}]}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Public'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.70.10.'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Public'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'905'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'905'}, {u'type': u'or', u'filters': [{u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 1'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL180 G6'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'dw'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'905'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth1'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL180 G6'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 3'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth1'}]}]```

### 5.22.23 - Application Cluster ```POSS-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.0.144.149|10.0.144.149|
|10.0.144.230|10.0.144.230|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.0.144.149'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.0.144.230'}]}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth0'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'852'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'852'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.0.144.'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.0.144.149'}, {u'filter': {u'field': u'user_Tier', u'type': u'eq', u'value': u'DEV/DB'}, u'type': u'not'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.0.144.'}, {u'field': u'user_isCluster', u'type': u'eq', u'value': u'Yes'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.0.144.230'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'852'}]}]```

### 5.22.24 - Application Cluster ```POSS-DB-BACKUP``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.64.28.176|10.64.28.176|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.176'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.28.176'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth1'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.28.176'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Backup'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth1'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'type': u'and', u'filters': [{u'field': u'user_isCluster', u'type': u'contains', u'value': u'No'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}]}, {u'type': u'and', u'filters': [{u'field': u'user_isCluster', u'type': u'contains', u'value': u'No'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}]}]```

### 5.22.25 - Application Cluster ```TIBCO-ANGIE-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.25.113|10.64.25.113|
|10.64.25.115|10.64.25.115|
|10.64.25.116|10.64.25.116|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.113'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.115'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.116'}]}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan901:80'}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan901:80'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan901:80'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.116'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan901:80'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.116'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'lan901:80'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901:801'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901:802'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.113'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901:801'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.113'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901:801'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901:801'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901:802'}]}]}]```

### 5.22.26 - Application Cluster ```TIBCO-ANGIE-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.25.112|10.64.25.112|
|10.64.25.114|10.64.25.114|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.112'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.25.114'}]}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.112'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.114'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.114'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.112'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.112'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.114'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.112'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmptibdb0'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.25.114'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'lan901'}]}]}]```

### 5.22.27 - Application Cluster ```TIBCO-APP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.208|10.64.18.208|
|10.64.19.79|10.64.19.79|
|10.64.19.80|10.64.19.80|
|10.64.19.81|10.64.19.81|
|10.64.19.82|10.64.19.82|
|10.64.19.83|10.64.19.83|
|10.64.19.84|10.64.19.84|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.208'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.79'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.80'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.81'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.82'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.83'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.84'}]}, {u'field': u'user_VM', u'type': u'contains', u'value': u'to_Tibco'}, {u'type': u'and', u'filters': [{u'field': u'user_VM', u'type': u'contains', u'value': u'to_Tibco'}, {u'field': u'user_Vlan', u'type': u'eq', u'value': u'408'}]}, {u'type': u'and', u'filters': [{u'field': u'user_VM', u'type': u'contains', u'value': u'to_Tibco'}, {u'field': u'user_Server', u'type': u'contains', u'value': u'ESXTIB0'}]}]```

### 5.22.28 - Application Cluster ```TIBCO-MGMT``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.64.18.215|10.64.18.215|
|10.64.19.90|10.64.19.90|
|10.64.19.91|10.64.19.91|
|10.64.19.92|10.64.19.92|
|10.64.19.93|10.64.19.93|
|10.64.19.94|10.64.19.94|
|10.64.19.95|10.64.19.95|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.215'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.90'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.91'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.92'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.93'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.94'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.95'}]}, {u'field': u'user_VM', u'type': u'contains', u'value': u'ESX Management'}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH6'}, {u'field': u'user_VM', u'type': u'eq', u'value': u'ESX Management'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'ESXTIB0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Tibo BW Prod ESX Host '}, {u'field': u'user_Cluster', u'type': u'contains', u'value': u'TIBCO BW PROD'}, {u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'user_Cluster', u'type': u'eq', u'value': u'TIBCO BW PROD'}, {u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL360 G9'}]}]```

### 5.22.29 - Application Cluster ```TIBCO-TEST``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.19.56|10.64.19.56|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.56'}]}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, {u'field': u'user_isCluster', u'type': u'eq', u'value': u'No'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.19.56'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Tibco LMS 4.0 Test Server'}, {u'field': u'user_isPRODUCTION', u'type': u'eq', u'value': u'Non-Prod'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmntibapp08_Temp1'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}, {u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 3'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.19.56'}, {u'field': u'user_isCluster', u'type': u'contains', u'value': u'No'}]```

### 5.22.30 - Application Cluster ```NG2-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.130|10.64.24.130|
|10.64.24.132|10.64.24.132|
|10.64.24.253|10.64.24.253|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.130'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.132'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.253'}]}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond2:'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2:1'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2:2'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond2:'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.132'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2:1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.132'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2:1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2:1'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2:2'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.130'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond2:'}]}]}]```

### 5.22.31 - Application Cluster ```NG2-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.239|10.64.24.239|
|10.64.24.254|10.64.24.254|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.239'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.254'}]}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.239'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.254'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.254'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpng2db02'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.239'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpng2db02'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.239'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.254'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.254'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}]}]```

### 5.22.32 - Application Cluster ```NG2-DB3``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|192.168.0.94|192.168.0.94|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.94'}]}, {u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.94'}, {u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.94'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpng2db01'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpng2db01'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.94'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}]```

### 5.22.33 - Application Cluster ```NG2-DB4``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|192.168.0.95|192.168.0.95|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.95'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.95'}, {u'field': u'host_name', u'type': u'eq', u'value': u'192.168.0.95'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpng2db02'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.95'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'NG2 DB Server 2'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}]```

### 5.22.34 - Application Cluster ```NG2-DB5``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.72|10.64.18.72|
|10.64.18.74|10.64.18.74|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.72'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.74'}]}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.18.7'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth1'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth1'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}, {u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}]```

### 5.22.35 - Application Cluster ```BILLING-APP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.61.16|10.64.61.16|
|10.64.61.18|10.64.61.18|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.16'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.18'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.16'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.18'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.18'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODRAT05'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 5'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODRAT06'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.18'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 5'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 5'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 6'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 5'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 6'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.18'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 5'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.18'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODRAT05'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Oracle Public'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 5'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODRAT06'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.16'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.18'}]}]}]```

### 5.22.36 - Application Cluster ```BILLING-APP2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.51|10.64.18.51|
|10.64.18.52|10.64.18.52|
|10.64.18.53|10.64.18.53|
|10.64.18.54|10.64.18.54|
|10.64.18.55|10.64.18.55|
|10.64.18.56|10.64.18.56|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.51'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.52'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.53'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.54'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.55'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.56'}]}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpsvlrat0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV10 App Server '}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.18.5'}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH451XF'}, {u'type': u'and', u'filters': [{u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV10 App Server '}]}, {u'type': u'and', u'filters': [{u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH451XF'}, {u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH451XF'}, {u'field': u'user_Application', u'type': u'contains', u'value': u'Intec SV'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Application', u'type': u'contains', u'value': u'Intec SV'}, {u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV10 App Server '}]}, {u'type': u'and', u'filters': [{u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH451XF'}, {u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}]}]```

### 5.22.37 - Application Cluster ```BILLING-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.1.194|10.64.1.194|
|10.64.76.14|10.64.76.14|
|10.64.76.16|10.64.76.16|
|10.64.76.20|10.64.76.20|
|10.64.80.35|10.64.80.35|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.1.194'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.76.14'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.76.16'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.76.20'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.80.35'}]}]```

### 5.22.38 - Application Cluster ```BILLING-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.61.29|10.64.61.29|
|10.64.61.30|10.64.61.30|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.29'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.30'}]}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0:'}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0:'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0:'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB05'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 4'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB05'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0:2'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB05'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0:'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 4'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0:1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB05'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 4'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0:1'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0:2'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 4'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0:1'}]}]}]```

### 5.22.39 - Application Cluster ```BILLING-DB3``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.76.11|10.64.76.11|
|10.64.76.13|10.64.76.13|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.76.11'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.76.13'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.76.1'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.76.1'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.76.13'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.76.1'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 03'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 03'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}]}]```

### 5.22.40 - Application Cluster ```BILLING-DB4``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.113|10.64.18.113|
|10.64.18.125|10.64.18.125|
|10.64.18.126|10.64.18.126|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.113'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.125'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.126'}]}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpsvldb0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV10 DB Server '}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.18.1'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'DL560 G10'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL560 G10'}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH81'}, {u'type': u'and', u'filters': [{u'field': u'user_Application', u'type': u'contains', u'value': u'Intec SV'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL560 G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Application', u'type': u'eq', u'value': u'Intec SV'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL560 G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Application', u'type': u'eq', u'value': u'Intec SV'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'DL560 G10'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV10 DB Server '}]}]```

### 5.22.41 - Application Cluster ```BILLING-DB5``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.61.20|10.64.61.20|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.20'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.20'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.20'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB01'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Oracle Public'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB01'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB01'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}]}]```

### 5.22.42 - Application Cluster ```Billing-DB6``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.80.31|10.64.80.31|
|10.64.80.32|10.64.80.32|
|10.64.80.33|10.64.80.33|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.80.31'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.80.32'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.80.33'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'554'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'554'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'554'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'554'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Non-Prod SV10 Rating 0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'554'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 01'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'554'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 01'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Non-Prod SV10 Rating 01'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktpknsvlrat0'}]}]}]```

### 5.22.43 - Application Cluster ```BILLING-DBMGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.61.142|10.64.61.142|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.142'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.142'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'443'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth5'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth5'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.142'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'443'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV Database Server 1'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMPRODDB01'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.142'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODDB01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV Database Server 1'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'443'}]}]```

### 5.22.44 - Application Cluster ```BILLING-RATING``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.61.12|10.64.61.12|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.12'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.12'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.12'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMPRODRAT03'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 3'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV Rating Server 3'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODRAT03'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.12'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.12'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 3'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV Rating Server 3'}]}]```

### 5.22.45 - Application Cluster ```BILLING-RATING2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.61.8|10.64.61.8|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.61.8'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.8'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Intec SV Rating Server 1'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.8'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMPRODRAT01'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPRODRAT01'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV Rating Server 1'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Intec SV Rating Server 1'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.61.8'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'440'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.8'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth8'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.61.8'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle Public'}]}]```

### 5.22.46 - Application Cluster ```ETL-APP``` :: external ```False``` approved ```True```
|ip|name|
|---|---|
|10.64.24.218|10.64.24.218|
|10.64.24.219|10.64.24.219|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.218'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.219'}]}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'413'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.21'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth4'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth4'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.219'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0'}]}]```

### 5.22.47 - Application Cluster ```ETL-MGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.21|10.64.18.21|
|10.64.28.20|10.64.28.20|
|172.28.8.218|172.28.8.218|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.21'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.20'}, {u'field': u'ip', u'type': u'eq', u'value': u'172.28.8.218'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'type': u'or', u'filters': [{u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmprdletl01'}, u'type': u'not'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmprdletl02'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.18.21'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.28.20'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Private'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'type': u'or', u'filters': [{u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmprdletl01'}, u'type': u'not'}, {u'filter': {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, u'type': u'not'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.18.21'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Private'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'filter': {u'field': u'user_Description', u'type': u'eq', u'value': u'New ETL Server 1'}, u'type': u'not'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.18.21'}, {u'field': u'host_name', u'type': u'eq', u'value': u'172.28.8.218'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth3'}, {u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmprdletl01'}, u'type': u'not'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.18.21'}, {u'filter': {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}, u'type': u'not'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'8.2'}, {u'type': u'or', u'filters': [{u'filter': {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}, u'type': u'not'}, {u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmprdletl01'}, u'type': u'not'}]}]}]```

### 5.22.48 - Application Cluster ```ETL-MGMT2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.29|10.64.18.29|
|10.64.18.30|10.64.18.30|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.29'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.30'}]}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'TK2'}, {u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}]```

### 5.22.49 - Application Cluster ```BIMARTRI-APP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.101|10.64.24.101|
|10.64.24.102|10.64.24.102|
|10.64.24.104|10.64.24.104|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.101'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.102'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.104'}]}]```

### 5.22.50 - Application Cluster ```BIMARTRI-APP-BACKUP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.29.105|10.64.29.105|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.105'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.29.105'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.29.105'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno02'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp05'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp05'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.29.105'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp05'}]}]```

### 5.22.51 - Application Cluster ```BIMARTRI-APP-BACKUP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.29.101|10.64.29.101|
|10.64.29.102|10.64.29.102|
|10.64.29.103|10.64.29.103|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.101'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.102'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.103'}]}]```

### 5.22.52 - Application Cluster ```BIMARTRI-APP-MGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.170|10.64.16.170|
|10.64.16.171|10.64.16.171|
|10.64.16.172|10.64.16.172|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.170'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.171'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.172'}]}]```

### 5.22.53 - Application Cluster ```BIMARTRI-APP-MGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.167|10.64.16.167|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.167'}]}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.167'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.16.167'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno01'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp02'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp02'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp02'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}]```

### 5.22.54 - Application Cluster ```BIMARTRI-APP-MGMT2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.166|10.64.16.166|
|10.64.16.169|10.64.16.169|
|10.64.24.103|10.64.24.103|
|10.64.29.104|10.64.29.104|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.166'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.169'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.103'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.104'}]}, {u'type': u'or', u'filters': [{u'type': u'and', u'filters': [{u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp04'}, u'type': u'not'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.166'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.103'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp04'}, {u'filter': {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}, u'type': u'not'}]}]}, {u'type': u'or', u'filters': [{u'type': u'and', u'filters': [{u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp04'}, u'type': u'not'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.166'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.103'}]}]}, {u'type': u'and', u'filters': [{u'filter': {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno03'}, u'type': u'not'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp04'}]}]}, {u'type': u'or', u'filters': [{u'type': u'and', u'filters': [{u'filter': {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp04'}, u'type': u'not'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.166'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.103'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp04'}, {u'filter': {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}, u'type': u'not'}]}]}]```

### 5.22.55 - Application Cluster ```BIMARTRI-APP-MGMT3``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.168|10.64.16.168|
|10.64.16.238|10.64.16.238|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.168'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.238'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.168'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno49'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.168'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.238'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.238'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp03'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno49'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Bimartri App Server 3'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno49'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp03'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno49'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Bimartri App Server 3'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.168'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpdb01'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno49'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp03'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.238'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Bimartri App Server 3'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.168'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpdb01'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}]}]}]```

### 5.22.56 - Application Cluster ```BIMARTRI-APP2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.105|10.64.24.105|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.105'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.105'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.105'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno03'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp05'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp05'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'413'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpapp05'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}]```

### 5.22.57 - Application Cluster ```BIMARTRI-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.210|10.64.24.210|
|10.64.24.243|10.64.24.243|
|10.64.24.246|10.64.24.246|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.210'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.243'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.246'}]}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1:'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1:'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eno5'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1:'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.210'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1:'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:1'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:2'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.210'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eno5'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.210'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eno5'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:1'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:2'}]}]}]```

### 5.22.58 - Application Cluster ```BIMARTRI-DB-MGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.102|10.64.16.102|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.102'}]}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno50'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.102'}, {u'field': u'user_Server SN', u'type': u'eq', u'value': u'SGH622XAXA'}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH622XAXA'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eno50'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.16.102'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpodpdb02'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpdb02'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Bimartri DB Server 2'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpodpdb02'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0'}]}]```

### 5.22.59 - Application Cluster ```BIMARTRI-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.209|10.64.24.209|
|10.64.24.245|10.64.24.245|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.209'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.245'}]}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.209'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.209'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.209'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.245'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.245'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.2'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.209'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.245'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.245'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}]}]```

### 5.22.60 - Application Cluster ```BIMARTRI-WEB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.106|10.64.24.106|
|10.64.24.107|10.64.24.107|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.106'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.107'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.107'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno03'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Bimartri Web Server 2'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Bimartri Web Server 2'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.107'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb02'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno03'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb02'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.107'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Bimartri Web Server 2'}]}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.106'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb02'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}]}]```

### 5.22.61 - Application Cluster ```BIMARTRI-WEB-BACKUP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.29.108|10.64.29.108|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.29.108'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.29.108'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.29.108'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno02'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}]}]```

### 5.22.62 - Application Cluster ```BIMARTRI-WEB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.108|10.64.24.108|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.108'}]}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.108'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.108'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.108'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno03'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}]}]```

### 5.22.63 - Application Cluster ```BIMARTRI-WEB3``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.173|10.64.16.173|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.173'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.16.173'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.173'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eno01'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmpodpweb03'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}]}]```

### 5.22.64 - Application Cluster ```BIMATRI-FUSION``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.103|10.64.16.103|
|10.64.16.107|10.64.16.107|
|10.64.16.239|10.64.16.239|
|10.64.18.224|10.64.18.224|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.103'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.107'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.239'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.224'}]}, {u'field': u'user_Application', u'type': u'contains', u'value': u'ESX'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmpodpesx0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Bimatri ESX Host '}, {u'field': u'user_Application', u'type': u'eq', u'value': u'ESX'}, {u'field': u'user_Cluster', u'type': u'eq', u'value': u'ODP BIMATRI Fusion'}, {u'field': u'user_Cluster', u'type': u'contains', u'value': u'ODP BIMATRI Fusion'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}, {u'field': u'user_Cluster', u'type': u'eq', u'value': u'ODP BIMATRI Fusion'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.1'}, {u'field': u'user_Cluster', u'type': u'eq', u'value': u'ODP BIMATRI Fusion'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}, {u'field': u'user_Application', u'type': u'eq', u'value': u'ESX'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH'}, {u'field': u'user_Application', u'type': u'eq', u'value': u'ESX'}]}]```

### 5.22.65 - Application Cluster ```10.64.*``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.17.78|10.64.17.78|
|10.64.20.37|10.64.20.37|
|10.64.20.38|10.64.20.38|
|10.64.20.39|10.64.20.39|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.17.78'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.20.37'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.20.38'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.20.39'}]}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'Ethernet0'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet0'}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Siebel CRM Dev Server '}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'Ethernet0'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Siebel CRM Dev Server '}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Siebel CRM Dev Server '}, {u'type': u'or', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'411'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel CRM Dev Server 4 Jumphost'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Siebel CRM Dev Server '}, {u'type': u'or', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'411'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMNSIBJUMP01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Siebel CRM Dev Server '}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet0'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'411'}]}]}]```

### 5.22.66 - Application Cluster ```10.64.* [2]``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.19.141|10.64.19.141|
|10.64.32.24|10.64.32.24|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.19.141'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.32.24'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.19.141'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.19.141'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth10'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.19.141'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth10'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth2'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.19.141'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}]}]}, {u'type': u'or', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'420'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}]}]}]```

### 5.22.67 - Application Cluster ```10.64.16.24*``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.245|10.64.16.245|
|10.64.16.246|10.64.16.246|
|10.64.16.247|10.64.16.247|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.245'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.246'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.247'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.16.24'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'Ethernet2'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'Ethernet2'}]```

### 5.22.68 - Application Cluster ```10.64.18.254``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.18.254|10.64.18.254|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.18.254'}]}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH551Y4YJ'}, {u'field': u'user_Server SN', u'type': u'eq', u'value': u'SGH551Y4YJ'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond0'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond0'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth0'}, {u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.18.254'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.18.254'}, {u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}]```

### 5.22.69 - Application Cluster ```10.64.20.141``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.20.141|10.64.20.141|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.20.141'}]}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.20.141'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth6'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth6'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.20.141'}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'contains', u'value': u'Siebel Dev DB Server'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'jktmmsiebelnpdb01'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'411'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.20.141'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Siebel Dev DB Server'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'411'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'jktmmsiebelnpdb01'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}]```

### 5.22.70 - Application Cluster ```10.64.28.194``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.28.194|10.64.28.194|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.194'}]}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Backup'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.28.194'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond2'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.28.194'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond2'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth4'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth4'}]```

### 5.22.71 - Application Cluster ```1.1.0.*``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|1.1.0.2|1.1.0.2|
|1.1.0.3|1.1.0.3|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.2'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.3'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.2'}, {u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.3'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'1.1.0.'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.2'}, {u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.3'}]}]}]```

### 5.22.72 - Application Cluster ```1.1.0.* [2]``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|1.1.0.4|1.1.0.4|
|1.1.0.5|1.1.0.5|
|1.1.0.6|1.1.0.6|
|1.1.0.7|1.1.0.7|
|1.1.0.8|1.1.0.8|
|1.1.0.9|1.1.0.9|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.4'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.5'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.6'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.7'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.8'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.9'}]}]```

### 5.22.73 - Application Cluster ```1.1.0.12``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|1.1.0.12|1.1.0.12|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.12'}]}, {u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.12'}, {u'field': u'host_name', u'type': u'contains', u'value': u'1.1.0.12'}]```

### 5.22.74 - Application Cluster ```1.1.0.6*``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|1.1.0.63|1.1.0.63|
|1.1.0.64|1.1.0.64|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.63'}, {u'field': u'ip', u'type': u'eq', u'value': u'1.1.0.64'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.63'}, {u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.64'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'1.1.0.6'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.63'}, {u'field': u'host_name', u'type': u'eq', u'value': u'1.1.0.64'}]}]}]```

### 5.22.75 - Application Cluster ```192.168.0.1*``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|192.168.0.11|192.168.0.11|
|192.168.0.12|192.168.0.12|
|192.168.0.13|192.168.0.13|
|192.168.0.14|192.168.0.14|
|192.168.0.15|192.168.0.15|
|192.168.0.16|192.168.0.16|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.11'}, {u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.12'}, {u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.13'}, {u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.14'}, {u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.15'}, {u'field': u'ip', u'type': u'eq', u'value': u'192.168.0.16'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'192.168.0.1'}]```

### 5.22.76 - Application Cluster ```4.4.*``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|4.4.1.3|4.4.1.3|
|4.4.2.3|4.4.2.3|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'4.4.1.3'}, {u'field': u'ip', u'type': u'eq', u'value': u'4.4.2.3'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'4.4.1.3'}, {u'field': u'host_name', u'type': u'eq', u'value': u'4.4.2.3'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'4.4.'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'4.4.1.3'}, {u'field': u'host_name', u'type': u'eq', u'value': u'4.4.2.3'}]}]}]```

### 5.22.77 - Application Cluster ```4.4.* [2]``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|4.4.1.2|4.4.1.2|
|4.4.2.2|4.4.2.2|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'4.4.1.2'}, {u'field': u'ip', u'type': u'eq', u'value': u'4.4.2.2'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'4.4.1.2'}, {u'field': u'host_name', u'type': u'eq', u'value': u'4.4.2.2'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'4.4.'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'4.4.1.2'}, {u'field': u'host_name', u'type': u'eq', u'value': u'4.4.2.2'}]}]}]```

### 5.22.78 - Application Cluster ```4.4.* [3]``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|4.4.1.4|4.4.1.4|
|4.4.2.4|4.4.2.4|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'4.4.1.4'}, {u'field': u'ip', u'type': u'eq', u'value': u'4.4.2.4'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'4.4.1.4'}, {u'field': u'host_name', u'type': u'eq', u'value': u'4.4.2.4'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'4.4.'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'4.4.1.4'}, {u'field': u'host_name', u'type': u'eq', u'value': u'4.4.2.4'}]}]}]```

### 5.22.79 - Application Cluster ```COMPTEL-APP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.12|10.64.24.12|
|10.64.24.20|10.64.24.20|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.12'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.20'}]}]```

### 5.22.80 - Application Cluster ```COMPTEL-APP2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.10|10.64.24.10|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.10'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.10'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.10'}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.24.10'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPPROVAPP01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPPROVAPP01'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.10'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMPPROVAPP01'}]}]```

### 5.22.81 - Application Cluster ```COMPTEL-DB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.14|10.64.24.14|
|10.64.24.16|10.64.24.16|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.14'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.16'}]}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Production'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Database  Server'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth4'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Production'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1'}]}]```

### 5.22.82 - Application Cluster ```COMPTEL-DB-BACKUP``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.28.127|10.64.28.127|
|10.64.28.128|10.64.28.128|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.127'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.28.128'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.28.12'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'414'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth12'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Backup'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'414'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth12'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.28.128'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth12'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.28.128'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.28.127'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Backup'}]}]```

### 5.22.83 - Application Cluster ```COMPTEL-DB2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.24.15|10.64.24.15|
|10.64.24.17|10.64.24.17|
|10.64.24.18|10.64.24.18|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.15'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.17'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.24.18'}]}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1:'}, {u'type': u'or', u'filters': [{u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:1'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:2'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle VIP'}, {u'field': u'user_Bond Aliase', u'type': u'contains', u'value': u'bond1:'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.18'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:1'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.24.18'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle VIP'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Oracle VIP'}, {u'field': u'user_Bond Aliase', u'type': u'eq', u'value': u'bond1:2'}]}]```

### 5.22.84 - Application Cluster ```COMPTEL-DEV``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.36.12|10.64.36.12|
|10.64.36.14|10.64.36.14|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.36.12'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.36.14'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.12'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVSIT-01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.12'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVSIT-01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVSIT-01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - ORT  Server'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.36.1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.12'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - SIT  Server'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVSIT-01'}, {u'filter': {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}, u'type': u'not'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.36.1'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVSIT-01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - ORT  Server'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVSIT-01'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL580 G8'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.36.1'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - SIT  Server'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL580 G8'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.14'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'DL580 G8'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - SIT  Server'}, {u'filter': {u'field': u'user_Server Type', u'type': u'eq', u'value': u'BL460c G9'}, u'type': u'not'}]}]}]```

### 5.22.85 - Application Cluster ```COMPTEL-DEV2``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.36.9|10.64.36.9|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.36.9'}]}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.36.9'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0.410'}, {u'field': u'user_Physical Interface', u'type': u'contains', u'value': u'eth0.410'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.9'}, {u'type': u'and', u'filters': [{u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMNPPROVDB01'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0.410'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Development Server'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Development Server'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.9'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Development Server'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0.410'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMNPPROVDB01'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Development Server'}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}]}]```

### 5.22.86 - Application Cluster ```COMPTEL-MGMT``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.16.150|10.64.16.150|
|10.64.16.151|10.64.16.151|
|10.64.16.152|10.64.16.152|
|10.64.16.153|10.64.16.153|
|10.64.16.61|10.64.16.61|
|10.64.16.65|10.64.16.65|
|10.64.16.69|10.64.16.69|
|10.64.16.71|10.64.16.71|
|10.64.16.76|10.64.16.76|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.61'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.65'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.69'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.71'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.76'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.150'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.151'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.152'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.16.153'}]}, {u'field': u'user_Functionality', u'type': u'contains', u'value': u'Management'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}, {u'field': u'user_Vlan ID', u'type': u'contains', u'value': u'408'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.64.16.'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth5'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth6'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}]}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth5'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.153'}, {u'field': u'user_Vlan ID', u'type': u'eq', u'value': u'408'}]}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.16.153'}, {u'field': u'user_Functionality', u'type': u'eq', u'value': u'Management'}]}]```

### 5.22.87 - Application Cluster ```COMPTEL-NONPROD``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.64.36.10|10.64.36.10|
|10.64.36.16|10.64.36.16|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.64.36.10'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.64.36.16'}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - UAT Server'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVUAT-01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Non Prod Server'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.16'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVDEV-01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - UAT Server'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVUAT-01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.16'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'contains', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.10'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVUAT-01'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.36.1'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.10'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.16'}]}]}, {u'type': u'and', u'filters': [{u'field': u'user_Functionality', u'type': u'eq', u'value': u'Development Access'}, {u'type': u'or', u'filters': [{u'field': u'host_name', u'type': u'eq', u'value': u'10.64.36.16'}, {u'field': u'user_Physical Interface', u'type': u'eq', u'value': u'eth0'}]}]}, {u'type': u'and', u'filters': [{u'field': u'host_name', u'type': u'contains', u'value': u'10.64.36.1'}, {u'type': u'or', u'filters': [{u'field': u'user_Description', u'type': u'eq', u'value': u'Comptel - Non Prod Server'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'MMNPROVUAT-01'}]}]}]```

### 5.22.88 - Application Cluster ```EXCHANGE-CAS``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.101.33.6|10.101.33.6|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.101.33.6'}]}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'SGH304M49T'}, {u'field': u'user_Server SN', u'type': u'eq', u'value': u'SGH304M49T'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.101.33.6'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Exchange CAS Server'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMCAS01'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'JKTMMCAS01'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Exchange CAS Server'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.101.33.6'}]```

### 5.22.89 - Application Cluster ```EXCHANGE-HUB``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.101.33.7|10.101.33.7|
|10.101.33.8|10.101.33.8|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.101.33.7'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.101.33.8'}]}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Exchange Hub Server'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Exchange Hub Server'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMHUB0'}]```

### 5.22.90 - Application Cluster ```EXCHANGE-MAILBOX``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.101.33.2|10.101.33.2|
|10.101.33.3|10.101.33.3|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.101.33.2'}, {u'field': u'ip', u'type': u'eq', u'value': u'10.101.33.3'}]}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Exchange Mailbox Server'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Exchange Mailbox Server'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'JKTMMMBX0'}]```

### 5.22.91 - Application Cluster ```DFS``` :: external ```False``` approved ```na```
|ip|name|
|---|---|
|10.101.32.46|10.101.32.46|
#### Queries ```[{u'type': u'or', u'filters': [{u'field': u'ip', u'type': u'eq', u'value': u'10.101.32.46'}]}, {u'field': u'user_Physical', u'type': u'eq', u'value': u'P'}, {u'field': u'user_Server Type', u'type': u'eq', u'value': u'SE1220'}, {u'field': u'user_Server Type', u'type': u'contains', u'value': u'SE1220'}, {u'field': u'user_Server SN', u'type': u'contains', u'value': u'CN711808W6'}, {u'field': u'user_Physical', u'type': u'contains', u'value': u'P'}, {u'field': u'user_Tier Type', u'type': u'eq', u'value': u'Tier 2'}, {u'field': u'host_name', u'type': u'eq', u'value': u'10.101.32.46'}, {u'field': u'user_Hostname', u'type': u'contains', u'value': u'Neptune0102'}, {u'field': u'user_Application', u'type': u'eq', u'value': u'File Server'}, {u'field': u'user_Application', u'type': u'contains', u'value': u'File Server'}, {u'field': u'host_name', u'type': u'contains', u'value': u'10.101.32.46'}, {u'field': u'user_Hostname', u'type': u'eq', u'value': u'Neptune0102'}, {u'field': u'user_Server SN', u'type': u'eq', u'value': u'CN711808W6'}, {u'field': u'user_Tier Type', u'type': u'contains', u'value': u'Tier 2'}, {u'field': u'user_Tier', u'type': u'eq', u'value': u'APP'}, {u'field': u'user_DC', u'type': u'contains', u'value': u'MM'}, {u'field': u'user_Description', u'type': u'eq', u'value': u'Distributed File System (DFS)'}, {u'field': u'user_Description', u'type': u'contains', u'value': u'Distributed File System (DFS)'}, {u'field': u'user_Tier', u'type': u'contains', u'value': u'APP'}, {u'field': u'user_DC', u'type': u'eq', u'value': u'MM'}]```


## 5.23 - Application Policies

**Application policies** represent the whitelist policies that are either Tetration discovered or user created. The polices listed are inclusive of all Application communication, both within the Application and between other Applications.

The table(s) below defines the list of Application Policies for Tetration cluster, **tetrahutch.three.co.id**. 

output/application_policies.csv

