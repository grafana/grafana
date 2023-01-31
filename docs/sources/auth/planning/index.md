# Plan IAM integration strategy

The following documentation is meant to shed light on the different authorization and authentications strategies available in Grafana. By doing preparation before implementation, the user will be able to decide which integration strategy suits best for their needs.

## Where are my users?

The first thing to consider is who are my users? Are the user exclusively within my organization or will they be outside of my organization?

If the users are within my organization, this means that Grafana might be able to integrate with those users by providing connection with to the corresponding Identiy Provider.

If the users are outside of my organization, this means that Grafana needs to provide anonymous access, which is not enabled by default.

### 🚧 How are my users organized?

### 🚧 Users in teams

### 🚧 Users in organizations

### 🚧 Choosing between teams and organizations

## 🚧 Do I have external systems?

### 🚧 Service Accounts

### 🚧 Personal access tokens

### 🚧 API keys

## 🚧 How to work with roles?

### 🚧 What are permissions?

### 🚧 What are roles?

### 🚧 Grafana roles vs RBAC: Which one is for me?

## 🚧 Will I need synchronization?

### 🚧 Team sync

### 🚧 Organization sync
