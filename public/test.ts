// Test file for plugin extension detection workflow
// This file contains the keywords that should trigger notifications

import { usePluginLinks, usePluginComponent } from '@grafana/runtime';

// This file should trigger the workflow when changed in a PR
console.log('Testing plugin extension detection', usePluginLinks);
