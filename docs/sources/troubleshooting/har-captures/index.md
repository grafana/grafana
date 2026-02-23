---
description: Learn how to generate a HAR capture to send to Grafana Labs support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - networking
labels:
  products:
    - cloud
    - enterprise
    - oss
menutitle: Generate a HAR capture
title: Generate a HAR capture to send to Grafana Labs support
weight: 300
---

# Troubleshoot with HAR captures

Support may request information about the network requests your browser generated in the form of a HAR file.

To generate a HAR capture, follow the steps for your browser:

## Chrome

1. In your Chrome browser, go to the page where the issue is occurring.
1. Click the menu icon and go to **More Tools** > **Developer Tools**.
1. In the drawer that opens, click the **Network** tab.
1. In the upper left hand corner of the drawer, make sure the round Record button is red. If it's grey, click the button to begin recording.
1. Select the **Preserve log** option box if it isn't already selected.
1. Click the grey crossed circle button to clear any existing requests from the panel.
1. Reproduce the issue while recording the network requests.
1. Click the download button to download the HAR file.
   <img width="1293" height="239" alt="image" src="https://github.com/user-attachments/assets/2ddd5bd4-d207-4c59-8143-f10009e0cb5d" />
1. Upload the HAR file to your Grafana Support ticket for investigation.

## Firefox

1. In your Firefox browser, go to the page where the issue is occurring.
1. Click the menu icon and go to **More Tools** > **Web Developer Tools**.
1. In the drawer that opens, click the **Network** tab.
1. In the upper left corner of the drawer, click the trash can icon to clear any existing requests from the recording.
1. Reproduce the issue while recording the network requests.
1. To save the HAR file, click the gear icon in the upper right hand corner of the panel and select **Save All As HAR**.
   <img width="1837" height="196" alt="image" src="https://github.com/user-attachments/assets/785be5e4-10a2-4d16-838a-2b7bb97c8453" />
1. Upload the HAR file to your Grafana Support ticket for investigation.

## Safari

1. In your Safari browser, go to the page where the issue is occurring.
1. Open the **Develop** menu option and select **Show Web Inspector**.
   {{< admonition type="note" >}}
   The **Show features for web developers** option needs to be enabled for the **Develop** option to appear. For more information, refer to [Use the developer tools in the Develop menu in Safari on Mac](https://support.apple.com/en-ie/guide/safari/sfri20948/mac).
   {{< /admonition >}}
1. In the panel that appears, click the **Network** tab.
1. In the upper right corner of the panel, click the trash can icon to clear any existing requests from the recording.
1. Reproduce the issue while recording the network requests.
1. Click the **Export** button to save the HAR file:
   <img width="1915" height="219" alt="image" src="https://github.com/user-attachments/assets/2bda7bbd-43bf-4ecb-b8f9-f0be92c5a480" />
1. Upload the HAR file to your Grafana Support ticket for investigation.

## Edge

1. In your Edge browser, go to the page where the issue is occurring.
1. Click the ... button and go to **More Tools** > **Developer Tools**.
1. In the panel that appears, click on the **Network** tab.
1. In the upper left hand corner of the panel, make sure the round Record button is red. If it's grey, click the button to begin recording
1. Verify that the **Preserve log** option box is checked.
1. Click the grey crossed circle button to clear any existing requests from the panel.
1. Reproduce the issue while the network requests are recorded.
1. Click the download button to save the HAR file:
   <img width="916" height="305" alt="image" src="https://github.com/user-attachments/assets/54dfd40d-751f-47b4-9824-bc5be1f027fa" />
1. Upload the HAR file to your Grafana Support ticket for investigation.
