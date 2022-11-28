---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - create templates
  - edit templates
  - delete templates
title: Create, edit and delete message templates
weight: 200
---

# Create, edit and delete message templates

Message templates can be found in the Contact points tab on the Alerting page. Here you can see a list of all your message templates. A message template can contain more than one template. For example, you might want to create a message template called `email` that contains all email templates.

## Create message templates

Step 1: Click the New template button:

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/list-message-templates-9-3.png" caption="List message templates" >}}

Step 2: Choose a name for the message template. This name is not the name of the template that you will use in notification policies, but the name of the template as it appears in the Contact points page. The templates that you will use in notification policies should be written in the content field. For example, the screenshot below shows a template called `email.subject`:

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/new-message-template-9-3.png" caption="New message template" >}}

When defining a template it is important to make sure the name is unique. For example, there should be no more than one template called `email.subject` in the same message template or across different message templates. You should also avoid defining templates with the same name as default templates such as `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`.

Step 3: To save the message template click the Save button.

## Edit message templates

Step 1: Find the message template that you want to edit in the list of message templates and click the Edit icon.

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/list-message-templates-with-template-9-3.png" caption="List message templates" >}}

Step 2: Edit the message template just as if you were creating a new message template.

Step 3: To save the message template click the Save button.

## Delete message templates

Step 1: Find the message template that you want to delete in the list of message templates and click the Delete (Trash) icon:

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/list-message-templates-with-template-9-3.png" caption="List message templates" >}}

Step 2: You will be ask to confirm that you want to delete the template. If you do want to delete the template click Yes, otherwise click Cancel:

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/delete-message-template-9-3.png" caption="Delete message template" >}}
