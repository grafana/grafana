---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/
description: Learn about toggles for experimental and beta features, which you can enable or disable.
title: Configure feature toggles
weight: 150
---

# Configure feature toggles

Feature toggles, also known as feature flags, are used for experimental or beta features in Grafana. Although we do not recommend that you use these features in production, you can turn on feature toggles to try out new functionality in development or test environments.

 This page contains a list of available feature toggles. To learn how to turn on feature toggles, refer to our [Configure Grafana documentation]({{< relref "../_index.md/#feature_toggles" >}}).

 ## Available feature toggles

 | Feature toggle name | Description                                           | Release stage | Requires dev mode? | Requires a restart? |
|---------------------|-------------------------------------------------------|---------------|--------------------|---------------------|
| `queryOverLive`     | Use grafana live websocket to execute backend queries | Experimental  | No                 | No                  |


<!-- 

Docs generation notes for Ryan

- I like feature toggle name in code brackets, implying users should literally use that text for their feature names
- Would be great if Description is overrideable, so that we can editorialize or add links to applicable docs. If that's too much work, then maybe you could add an extra column like Additional Notes where we could add those details?
- There's an open discussion about feature release stages; the current candidate names are Experimental, Beta, and Generally Available. I'm thinking we can map it like this:
  - FeatureStateAlpha = Experimental
  - FeatureStateBeta = Beta
  - FeatureStateStable = Generally Available
  
 -->