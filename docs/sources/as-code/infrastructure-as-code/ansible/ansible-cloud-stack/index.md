---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Ansible
title: Create and manage a Grafana Cloud stack using Ansible
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/ansible/ansible-cloud-stack/
---

# Create and manage a Grafana Cloud stack using Ansible

Learn how to add a data source, a dashboard, and a folder to a Grafana Cloud stack using Ansible collection for Grafana.

## Before you begin

Before you begin, you should have the following available:

- A Grafana Cloud account.
- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/index.html) installed on your machine

## Create a Cloud stack

1. Create a Grafana Cloud Access Policy and get a token.
   You'll need this for the Ansible playbook to be able to create a Grafana Cloud stack.
   Refer to [Create a Grafana Cloud Access Policy](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/create-access-policies/).

1. Create an Ansible playbook file.

   This Ansible playbook will create a Grafana Cloud stack by using the [Cloud stack module](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/cloud_stack_module.html#ansible-collections-grafana-grafana-cloud-stack-module).

   Create a file named `cloud-stack.yml` and add the following:

   ```yaml
   - name: Create Grafana Cloud stack
     connection: local
     hosts: localhost

     vars:
       grafana_cloud_api_key: '<Your Cloud Access Policy token>'
       stack_name: '<stack-name>'
       org_name: '<org-name>'

     tasks:
       - name: Create a Grafana Cloud stack
         grafana.grafana.cloud_stack:
           name: '{{ stack_name }}'
           stack_slug: '{{ stack_name }}'
           cloud_api_key: '{{ grafana_cloud_api_key }}'
           org_slug: '{{ org_name }}'
           delete_protection: true
           state: present
   ```

1. Replace the following field values:
   - `<token>` with a token from the Cloud Access Policy you created in the Grafana Cloud portal.
   - `<stack-name>` with the name of your stack.
   - `<org-name>` with the name of the organization in Grafana Cloud.

## Create an API key in the Grafana stack

Create an API key in the Grafana stack.
You'll need this key to configure Ansible to be able to create data source, folders, and dashboards.

1. Log into your Grafana Cloud instance.
2. Click **Administration** and select **API keys**.
3. Click **Add API key**.
4. In **Key name**, enter a name for your API key.
5. In **Role**, select **Admin** or **Editor** to associate the role with this API key.
6. Click **Copy** to save it for later use.

## Add a data source

This guide uses the InfluxDB data source.
The required arguments vary depending on the type of data source you select.

1. Create a file named `data-source.yml` and add the following:

   ```yaml
   - name: Add/Update data source
     connection: local
     hosts: localhost

     vars:
       data_sources:
         [
           {
             name: '<data-source-name>',
             type: 'influxdb',
             url: '<data-source-url>',
             user: '<username>',
             secureJsonData: { password: '<password>' },
             database: '<db-name>',
             id: <id>,
             uid: '<uid>',
             access: 'proxy',
           },
         ]

       grafana_api_key: '<API-Key>'
       stack_name: '<stack-name>'

     tasks:
       - name: Create/Update Data sources
         grafana.grafana.datasource:
           datasource: '{{ item }}'
           stack_slug: '{{ stack_name }}'
           grafana_api_key: '{{ grafana_api_key }}'
           state: present
         loop: '{{ data_sources }}'
   ```

1. Replace the following field values:
   - `<data-source-name>` with the name of the data source to be added in Grafana.
   - `<data-source-url>` with URL of your data source.
   - `<username>` with the username for authenticating with your data source.
   - `<password>` with the password for authenticating with your data source.
   - `<db-name>` with name of your database.
   - `<id>` with the ID for your data source in Grafana.
   - `<uid>` wth the UID for your data source in Grafana.
   - `<stack-name>` with the name of your stack.
   - `<API-key>` with the [API key created in the Grafana instance](#create-an-api-key-in-the-grafana-stack).

## Add a folder

This Ansible playbook creates a folder in your Grafana instance by using the [Folder module](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/folder_module.html#ansible-collections-grafana-grafana-folder-module).

1. Create a file named `folder.yml` and add the following:

   ```yaml
   - name: Add/Update Folders
     connection: local
     hosts: localhost

     vars:
       folders: [{ title: '<folder-name>', uid: '<uid>' }]

       stack_name: '<stack-name>'
       grafana_api_key: <API-key>

     tasks:
       - name: Create/Update a Folder in Grafana
         grafana.grafana.folder:
           title: '{{ item.title }}'
           uid: '{{ item.uid }}'
           stack_slug: '{{ stack_name }}'
           grafana_api_key: '{{ grafana_api_key }}'
           state: present
         loop: '{{ folders }}'
   ```

1. Replace the following field values:
   - `<folder-name>` with the name of the folder to be added in Grafana.
   - `<uid>` with the UID for your folder in Grafana.
   - `<stack-name>` with the name of your stack.
   - `<API-key>` with the [API key created in the Grafana instance](#create-an-api-key-in-the-grafana-stack).

## Add a dashboard to the folder

This Ansible playbook iterates through the dashboard JSON source code files in the folder referenced in `dashboards_path` and adds them in the Grafana instance by using the [Dashboard module](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/dashboard_module.html#ansible-collections-grafana-grafana-dashboard-module).

1. Create a file named `dashboard.yml` and add the following:

   ```yaml
   - name: Add/Update Dashboards
     connection: local
     hosts: localhost

     vars:
       dashboards_path: <path-to-dashboard-files> # Example "./dashboards"
       stack_name: "<stack-name>"
       grafana_api_key: <API-key>

     tasks:
       - name: Find dashboard files
         find:
           paths: "{{ dashboards_path }}"
           file_type: file
           recurse: Yes
           patterns: "*.json"
         register: files_matched
         no_log: True

       - name: Create list of dashboard file names
         set_fact:
           dashboard_file_names: "{{ dashboard_file_names | default ([]) + [item.path] }}"
         loop: "{{ files_matched.files }}"
         no_log: True

      - name: Create/Update a dashboard
        grafana.grafana.dashboard:
          dashboard: "{{ lookup('ansible.builtin.file','{{ item }}' ) }}"
          stack_slug: "{{ stack_name }}"
          grafana_api_key: "{{ grafana_api_key }}"
          state: present
        loop: "{{ dashboard_file_names }}"
   ```

1. Replace the following field values:
   - `<path-to-dashboard-files>` with the path to the folder containing dashboard JSON source code files.
   - `<stack-name>` with the name of your stack.
   - `<API-key>` with the [API key created in the Grafana instance](#create-an-api-key-in-the-grafana-stack).

## Run the Ansible playbooks

In a terminal, run the following commands from the directory where all of the Ansible playbooks are located.

1. To create the Grafana Cloud stack.

   ```shell
   ansible-playbook cloud-stack.yml
   ```

1. To add a data source to the Grafana stack.

   ```shell
   ansible-playbook data-source.yml
   ```

1. To add a folder to the Grafana stack

   ```shell
   ansible-playbook folder.yml
   ```

1. To add a dashboard to the folder in your Grafana stack.

   ```shell
   ansible-playbook dashboard.yml
   ```

## Validation

Once you run the Ansible playbooks, you should be able to verify the following:

- The new Grafana stack is created and visible in the Cloud Portal.

  ![Cloud Portal](/static/img/docs/grafana-cloud/terraform/cloud_portal_tf.png)

- A new data source (InfluxDB in this example) is visible in the Grafana stack.

  ![InfluxDB datasource](/media/docs/grafana-cloud/screenshot-influxdb_datasource_tf.png)

- A new folder in Grafana.
  In the following image, a folder named `Demos` was added.

  ![Folder](/media/docs/grafana-cloud/screenshot-folder_tf.png)

- A new dashboard in the Grafana stack.
  In the following image a dashboard named `InfluxDB Cloud Demos` was created inside the "Demos" folder.

  ![InfluxDB dashboard](/static/img/docs/grafana-cloud/terraform/influxdb_dashboard_tf.png)

## Summary

In this guide, you created a Grafana Cloud stack along with a data source, folder, and dashboard imported from a JSON file using Ansible.

To learn more about managing Grafana using Ansible, refer to the [Grafana Ansible collection](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/).
