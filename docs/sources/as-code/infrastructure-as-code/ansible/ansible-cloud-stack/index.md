---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Ansible
title: Create and manage your Grafana Cloud stack using Ansible
menuTitle: Manage stack using Ansible
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/ansible/ansible-cloud-stack/
---

# Create and manage your Grafana Cloud stack using Ansible

This guide shows you how to create a Grafana Cloud stack and add a data source, dashboard, and folder using the Ansible Collection for Grafana. You'll manage your Grafana infrastructure through Ansible playbooks.

## Before you begin

Before you begin, make sure you have the following available:

- A Grafana Cloud account
- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/index.html) installed on your machine

## Install the Grafana Ansible collection

Install the Grafana Ansible collection:

```sh
ansible-galaxy collection install grafana.grafana
```

This collection provides all the modules needed to manage Grafana Cloud stacks and resources.

## Create a Cloud stack

First, create a Grafana Cloud Access Policy and get a token. You'll need this for the Ansible playbook to be able to create a Grafana Cloud stack. Refer to [Create a Grafana Cloud Access Policy](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/create-access-policies/).

Next, create an Ansible playbook file. This Ansible playbook creates a Grafana Cloud stack using the [Cloud stack module](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/cloud_stack_module.html#ansible-collections-grafana-grafana-cloud-stack-module).

To do so, create a file named `cloud-stack.yml` and add the following:

```yaml
- name: Create Grafana Cloud stack
  connection: local
  hosts: localhost

  vars:
    grafana_cloud_api_key: '<CLOUD_ACCESS_POLICY_TOKEN>'
    stack_name: '<STACK_NAME>'
    org_name: '<ORG_NAME>'

  tasks:
    - name: Create a Grafana Cloud stack
      grafana.grafana.cloud_stack:
        name: '{{ stack_name }}'
        stack_slug: '{{ stack_name }}'
        cloud_api_key: '{{ grafana_cloud_api_key }}'
        org_slug: '{{ org_name }}'
        delete_protection: true
        state: present
      register: stack_result

    - name: Display stack URL
      debug:
        msg: 'Stack created at: {{ stack_result.url }}'
```

Replace the placeholders with your values:

- _`<CLOUD_ACCESS_POLICY_TOKEN>`_: Token from the Cloud Access Policy you created in the Grafana Cloud portal
- _`<STACK_NAME>`_: Name of your stack
- _`<ORG_NAME>`_: Name of the organization in Grafana Cloud

The playbook registers the stack creation result and displays the stack URL, which you'll need for subsequent resource management.

## Create an API key in your Grafana stack

Create an API key in the Grafana stack. You'll need this key to configure Ansible to create data sources, folders, and dashboards.

1. Log into your Grafana Cloud instance.
2. Click **Administration** and select **API keys**.
3. Click **Add API key**.
4. In **Key name**, enter a name for your API key.
5. In **Role**, select **Admin** or **Editor** to associate the role with this API key.
6. Click **Copy** to save it for later use.

## Add resources using playbooks

### Add a data source

The following steps use the InfluxDB data source. The required arguments vary depending on the type of data source you select.

Create a file named `data-source.yml`:

```yaml
- name: Add/Update data source
  connection: local
  hosts: localhost

  vars:
    grafana_url: 'https://<STACK_NAME>.grafana.net'
    grafana_api_key: '<GRAFANA_API_KEY>'
    data_source_config:
      name: '<DATA_SOURCE_NAME>'
      type: 'influxdb'
      url: '<DATA_SOURCE_URL>'
      user: '<USERNAME>'
      secureJsonData:
        password: '<PASSWORD>'
      database: '<DATABASE_NAME>'
      uid: '<UID>'
      access: 'proxy'

  tasks:
    - name: Create/Update Data source
      grafana.grafana.datasource:
        dataSource: '{{ data_source_config }}'
        grafana_url: '{{ grafana_url }}'
        grafana_api_key: '{{ grafana_api_key }}'
        state: present
```

Replace the placeholders with your values:

- _`<DATA_SOURCE_NAME>`_: Name of the data source to be added in Grafana
- _`<DATA_SOURCE_URL>`_: URL of your data source
- _`<USERNAME>`_: Username for authenticating with your data source
- _`<PASSWORD>`_: Password for authenticating with your data source
- _`<DATABASE_NAME>`_: Name of your database
- _`<UID>`_: UID for your data source in Grafana
- _`<STACK_NAME>`_: Name of your stack
- _`<GRAFANA_API_KEY>`_: API key created in the Grafana instance

### Add a folder

This playbook creates a folder in your Grafana instance using the [Folder module](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/folder_module.html#ansible-collections-grafana-grafana-folder-module).

Create a file named `folder.yml`:

```yaml
- name: Add/Update Folders
  connection: local
  hosts: localhost

vars:
    grafana_url: 'https://<STACK_NAME>.grafana.net'
    grafana_api_key: '<GRAFANA_API_KEY>'
    folders:
      - title: '<FOLDER_NAME>'
        uid: '<UID>'

  tasks:
    - name: Create/Update a Folder in Grafana
      grafana.grafana.folder:
        title: '{{ item.title }}'
        uid: '{{ item.uid }}'
        grafana_url: '{{ grafana_url }}'
        grafana_api_key: '{{ grafana_api_key }}'
        state: present
      loop: '{{ folders }}'
```

Replace the placeholders with your values:

- _`<FOLDER_NAME>`_: Name of the folder to be added in Grafana
- _`<UID>`_: UID for your folder in Grafana
- _`<STACK_NAME>`_: Name of your stack
- _`<GRAFANA_API_KEY>`_: API key created in the Grafana instance

### Add a dashboard to the folder

This playbook iterates through the dashboard JSON source code files in the folder referenced in `dashboards_path` and adds them to the Grafana instance using the [Dashboard module](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/dashboard_module.html#ansible-collections-grafana-grafana-dashboard-module).

Create a file named `dashboard.yml`:

```yaml
- name: Add/Update Dashboards
  connection: local
  hosts: localhost

  vars:
    grafana_url: 'https://<STACK_NAME>.grafana.net'
    grafana_api_key: '<GRAFANA_API_KEY>'
    dashboards_path: '<PATH_TO_DASHBOARD_FILES>' # Example "./dashboards"

  tasks:
    - name: Find dashboard files
      find:
        paths: '{{ dashboards_path }}'
        file_type: file
        recurse: true
        patterns: '*.json'
      register: files_matched
      no_log: true

    - name: Create list of dashboard file names
      set_fact:
        dashboard_file_names: '{{ dashboard_file_names | default([]) + [item.path] }}'
      loop: '{{ files_matched.files }}'
      no_log: true

    - name: Create/Update a dashboard
      grafana.grafana.dashboard:
        dashboard: "{{ lookup('ansible.builtin.file', item) }}"
        grafana_url: '{{ grafana_url }}'
        grafana_api_key: '{{ grafana_api_key }}'
        state: present
      loop: '{{ dashboard_file_names }}'
```

Replace the placeholders with your values:

- _`<PATH_TO_DASHBOARD_FILES>`_: Path to the folder containing dashboard JSON source code files
- _`<STACK_NAME>`_: Name of your stack
- _`<GRAFANA_API_KEY>`_: API key created in the Grafana instance

## Run the Ansible playbooks

In a terminal, run the following commands from the directory where all of the Ansible playbooks are located.

Create the Grafana Cloud stack:

```sh
ansible-playbook cloud-stack.yml
```

Add a data source to the Grafana stack:

```sh
ansible-playbook data-source.yml
```

Add a folder to the Grafana stack:

```sh
ansible-playbook folder.yml
```

Add a dashboard to the folder in your Grafana stack:

```sh
ansible-playbook dashboard.yml
```

## Validate your configuration

After you've run the Ansible playbooks, you can verify the following:

- The new Grafana Cloud stack is created and visible in the Cloud Portal.

  ![Cloud Portal](/static/img/docs/grafana-cloud/terraform/cloud_portal_tf.png)

- A new data source (InfluxDB in this example) is visible in the Grafana stack.

  ![InfluxDB datasource](/media/docs/grafana-cloud/screenshot-influxdb_datasource_tf.png)

- A new folder is available in your Grafana stack. In the following image, a folder named `Demos` was added.

  ![Folder](/media/docs/grafana-cloud/screenshot-folder_tf.png)

- A new dashboard is visible in the Grafana stack. In the following image, a dashboard named `InfluxDB Cloud Demos` was created inside the "Demos" folder.

  ![InfluxDB dashboard](/static/img/docs/grafana-cloud/terraform/influxdb_dashboard_tf.png)

## Next steps

You've successfully created a Grafana Cloud stack along with a data source, a folder, and a dashboard using Ansible. Your Grafana infrastructure is now managed through code.

To learn more about managing Grafana with Infrastructure as code:

- [Grafana Ansible collection documentation](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/)
- [Ansible playbook best practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [Grafana API documentation](/docs/grafana/latest/developers/http_api/)
- [Grafana Cloud API documentation](https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/)
- [Infrastructure as Code with Terraform](/docs/grafana/latest/as-code/infrastructure-as-code/terraform/)
