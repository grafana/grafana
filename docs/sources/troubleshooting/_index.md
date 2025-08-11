---
aliases:
  - troubleshoot-dashboards/
description: Guide to troubleshooting Grafana problems
keywords:
  - grafana
  - troubleshooting
  - documentation
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Troubleshooting
weight: 180
---

# Troubleshooting

This page lists some tools and advice to help troubleshoot common Grafana issues.

## Troubleshoot with logs

If you encounter an error or problem, then you can check the Grafana server log. Usually located at `/var/log/grafana/grafana.log` on Unix systems or in `<grafana_install_dir>/data/log` on other platforms and manual installations.

You can enable more logging by changing log level in the Grafana configuration file.

For more information, refer to [Enable debug logging in Grafana CLI](../cli/#enable-debug-logging) and the [log section in Configuration](../setup-grafana/configure-grafana/#log).

## Troubleshoot with Dashboards Panels

If you have an issue with your Dashboard panel, you can send us debug information. For more information, refer to [Send a panel to Grafana Labs support](send-panel-to-grafana-support/).

## Troubleshoot with support bundles

If you have an issue with your Grafana instance, you can generate an archive containing information concerning the state and the configuration of the instance.

To send us a bundle for advanced support, refer to [Send a support bundle to Grafana Labs support](support-bundles/).

## Troubleshoot transformations

Order of transformations matters. If the final data output from multiple transformations looks wrong, try changing the transformation order. Each transformation transforms data returned by the previous transformation, not the original raw data.

For more information, refer to [Debug a transformation](../panels-visualizations/query-transform-data/transform-data/#debug-a-transformation).

## Text missing with server-side image rendering (RPM-based Linux)

Server-side image (png) rendering is a feature that is optional but very useful when sharing visualizations, for example in alert notifications.

If the image is missing text, then make sure you have font packages installed.

```bash
sudo yum install fontconfig
sudo yum install freetype*
sudo yum install urw-fonts
```

## Troubleshoot backend performance

If you're experiencing backend performance problems, such as high memory or CPU usage, please refer to [Configure profiling and tracing to troubleshoot Grafana](../setup-grafana/configure-grafana/configure-tracing/).

## Troubleshoot with HAR captures

Support may request information about the network requests generated in your browser in the form of a HAR file.

Generating a HAR capture in Chrome:

1. In your Chrome browser, go to the page where the issue is occurring.
2. Click on the ⋮ button and select More Tools > Developer Tools.
3. In the panel that appears, click on the Network tab.
4. In the upper left hand corner of the panel, make sure that the round Record button is red. (If it is grey, select the button to begin recording)
5. Verify that the "Preserve log" option box is checked.
6. Click the grey crossed circle button to clear any existing requests from the panel.
7. Reproduce the issue while the network requests are recorded.
8. Click the "Export HAR" button to download the HAR file.
   <img width="1293" height="239" alt="image" src="https://github.com/user-attachments/assets/2ddd5bd4-d207-4c59-8143-f10009e0cb5d" />
9. Upload the HAR file to your Grafana Support ticket for investigation.

Generating a HAR capture in Firefox:

1. In your Firefox browser, go to the page where the issue is occurring.
2. Click on the ≡ button and select More Tools > Web Developer Tools.
3. In the panel that appears, click on the Network tab.
4. In the upper left corner of the panel, click the trash can icon to clear any existing requests from the recording.
5. Reproduce the issue while the network requests are recorded.
6. To save the HAR file, click on the gear icon in the upper right hand corner of the panel and select "Save All As HAR"
   <img width="1837" height="196" alt="image" src="https://github.com/user-attachments/assets/785be5e4-10a2-4d16-838a-2b7bb97c8453" />
7. Upload the HAR file to your Grafana Support ticket for investigation.

Generating a HAR capture in Safari:

1. In your Safari browser, go to the page where the issue is occurring.
2. Open the "Develop" menu option and select "Show Web Inspector" (Note: The "Show features for web developers" will need to be enabled for the Develop option to appear. More info from the Safari user guide here: [Use the developer tools in the Develop menu in Safari on Mac](https://support.apple.com/en-ie/guide/safari/sfri20948/mac).
3. In the panel that appears, click on the Network tab.
4. In the upper right corner of the panel, click the trash can icon to clear any existing requests from the recording.
5. Reproduce the issue while the network requests are recorded.
6. Click the "Export" button to save the HAR file:
   <img width="1915" height="219" alt="image" src="https://github.com/user-attachments/assets/2bda7bbd-43bf-4ecb-b8f9-f0be92c5a480" />
7. Upload the HAR file to your Grafana Support ticket for investigation.

Generating a HAR capture in Edge:

1. In your Edge browser, go to the page where the issue is occurring.
2. Click on the ... button and select More Tools > Developer Tools.
3. In the panel that appears, click on the Network tab.
4. In the upper left hand corner of the panel, make sure that the round Record button is red. (If it is grey, select the button to begin recording)
5. Verify that the "Preserve log" option box is checked.
6. Click the grey crossed circle button to clear any existing requests from the panel.
7. Reproduce the issue while the network requests are recorded.
8. Click the "Export HAR" button to save the HAR file:
   <img width="916" height="305" alt="image" src="https://github.com/user-attachments/assets/54dfd40d-751f-47b4-9824-bc5be1f027fa" />
10. Upload the HAR file to your Grafana Support ticket for investigation.


## More help

Check out the [Grafana Community](https://community.grafana.com/) for more troubleshooting help (you must be logged in to post or comment).
