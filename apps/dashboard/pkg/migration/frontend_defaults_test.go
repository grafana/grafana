package migration

// TestFrontendDefaultsSuite tests all the logic of mimicking DashboardModel and PanelModel behavior
// including the new cleanup logic that mimics getSaveModel()
// func TestFrontendDefaultsSuite(t *testing.T) {
// 	t.Run("DashboardModel Defaults", func(t *testing.T) {
// 		t.Run("should apply all dashboard-level defaults", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"title": "Test Dashboard",
// 			}

// 			applyFrontendDefaults(dashboard)

// 			// Check that all DashboardModel defaults are applied
// 			assertMapHasKey(t, dashboard, "editable")
// 			assertMapHasKey(t, dashboard, "graphTooltip")
// 			assertMapHasKey(t, dashboard, "timezone")
// 			assertMapHasKey(t, dashboard, "weekStart")
// 			assertMapHasKey(t, dashboard, "fiscalYearStartMonth")
// 			assertMapHasKey(t, dashboard, "version")
// 			assertMapHasKey(t, dashboard, "links")
// 			assertMapHasKey(t, dashboard, "gnetId")

// 			// Check specific default values
// 			assertEqual(t, true, dashboard["editable"])
// 			assertEqual(t, float64(0), dashboard["graphTooltip"])
// 			assertEqual(t, "", dashboard["timezone"])
// 			assertEqual(t, "", dashboard["weekStart"])
// 			assertEqual(t, float64(0), dashboard["fiscalYearStartMonth"])
// 			assertEqual(t, float64(0), dashboard["version"])
// 			assertEqual(t, []interface{}{}, dashboard["links"])
// 			assertEqual(t, nil, dashboard["gnetId"])

// 			// Note: The frontend does NOT set defaults for these properties:
// 			// - liveNow: copied as-is from input data
// 			// - refresh: copied as-is from input data
// 			// - snapshot: copied as-is from input data
// 			// - scopeMeta: copied as-is from input data
// 		})

// 		t.Run("should preserve existing values", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"title":    "Test Dashboard",
// 				"editable": false,
// 				"timezone": "UTC",
// 				"refresh":  "5s",
// 			}

// 			applyFrontendDefaults(dashboard)

// 			// Check that existing values are preserved
// 			assertEqual(t, "Test Dashboard", dashboard["title"])
// 			assertEqual(t, false, dashboard["editable"])
// 			assertEqual(t, "UTC", dashboard["timezone"])
// 			assertEqual(t, "5s", dashboard["refresh"])
// 		})

// 		t.Run("should add built-in annotation query", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"title": "Test Dashboard",
// 			}

// 			applyFrontendDefaults(dashboard)

// 			annotations, ok := dashboard["annotations"].(map[string]interface{})
// 			assertTrue(t, ok, "annotations should exist")

// 			list, ok := annotations["list"].([]interface{})
// 			assertTrue(t, ok, "annotations.list should exist")
// 			assertTrue(t, len(list) > 0, "should have at least one annotation")

// 			builtInAnnotation := list[0].(map[string]interface{})
// 			assertEqual(t, float64(1), builtInAnnotation["builtIn"])
// 			assertEqual(t, "Annotations & Alerts", builtInAnnotation["name"])
// 			assertEqual(t, "dashboard", builtInAnnotation["type"])
// 			assertEqual(t, "rgba(0, 211, 255, 1)", builtInAnnotation["iconColor"])
// 			assertEqual(t, true, builtInAnnotation["enable"])
// 			assertEqual(t, true, builtInAnnotation["hide"])

// 			datasource, ok := builtInAnnotation["datasource"].(map[string]interface{})
// 			assertTrue(t, ok, "datasource should exist")
// 			assertEqual(t, "-- Grafana --", datasource["uid"])
// 			assertEqual(t, "grafana", datasource["type"])
// 		})

// 		t.Run("should ensure templating and annotations exist", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"title": "Test Dashboard",
// 			}

// 			applyFrontendDefaults(dashboard)

// 			// Check templating
// 			templating, ok := dashboard["templating"].(map[string]interface{})
// 			assertTrue(t, ok, "templating should exist")
// 			list, ok := templating["list"].([]interface{})
// 			assertTrue(t, ok, "templating.list should exist")
// 			assertEqual(t, 0, len(list))

// 			// Check annotations
// 			annotations, ok := dashboard["annotations"].(map[string]interface{})
// 			assertTrue(t, ok, "annotations should exist")
// 			list, ok = annotations["list"].([]interface{})
// 			assertTrue(t, ok, "annotations.list should exist")
// 			assertTrue(t, len(list) > 0, "should have built-in annotation")
// 		})

// 		t.Run("should add meta defaults", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"title": "Test Dashboard",
// 			}

// 			applyFrontendDefaults(dashboard)

// 			meta, ok := dashboard["meta"].(map[string]interface{})
// 			assertTrue(t, ok, "meta should exist")

// 			// Check meta defaults
// 			assertEqual(t, true, meta["canShare"])
// 			assertEqual(t, true, meta["canSave"])
// 			assertEqual(t, true, meta["canStar"])
// 			assertEqual(t, true, meta["canEdit"])
// 			assertEqual(t, true, meta["canDelete"])
// 			assertEqual(t, true, meta["showSettings"])
// 			assertEqual(t, false, meta["canMakeEditable"])
// 			assertEqual(t, false, meta["hasUnsavedFolderChange"])
// 		})
// 	})

// 	t.Run("PanelModel Defaults", func(t *testing.T) {
// 		t.Run("should apply all panel-level defaults", func(t *testing.T) {
// 			panel := map[string]interface{}{
// 				"title": "Test Panel",
// 			}

// 			applyPanelDefaults(panel)

// 			// Check that all PanelModel defaults are applied
// 			assertMapHasKey(t, panel, "gridPos")
// 			assertMapHasKey(t, panel, "targets")
// 			assertMapHasKey(t, panel, "cachedPluginOptions")
// 			assertMapHasKey(t, panel, "transparent")
// 			assertMapHasKey(t, panel, "options")
// 			assertMapHasKey(t, panel, "links")
// 			assertMapHasKey(t, panel, "transformations")
// 			assertMapHasKey(t, panel, "fieldConfig")

// 			// Check specific default values
// 			gridPos, ok := panel["gridPos"].(map[string]interface{})
// 			assertTrue(t, ok, "gridPos should exist")
// 			assertEqual(t, float64(0), gridPos["x"])
// 			assertEqual(t, float64(0), gridPos["y"])
// 			assertEqual(t, float64(3), gridPos["h"])
// 			assertEqual(t, float64(6), gridPos["w"])

// 			targets, ok := panel["targets"].([]interface{})
// 			assertTrue(t, ok, "targets should exist")
// 			assertEqual(t, 1, len(targets))
// 			target := targets[0].(map[string]interface{})
// 			assertEqual(t, "A", target["refId"])

// 			assertEqual(t, map[string]interface{}{}, panel["cachedPluginOptions"])
// 			assertEqual(t, false, panel["transparent"])
// 			assertEqual(t, map[string]interface{}{}, panel["options"])
// 			assertEqual(t, []interface{}{}, panel["links"])
// 			assertEqual(t, []interface{}{}, panel["transformations"])

// 			fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
// 			assertTrue(t, ok, "fieldConfig should exist")
// 			assertEqual(t, map[string]interface{}{}, fieldConfig["defaults"])
// 			assertEqual(t, []interface{}{}, fieldConfig["overrides"])
// 		})

// 		t.Run("should preserve existing values", func(t *testing.T) {
// 			panel := map[string]interface{}{
// 				"title": "Test Panel",
// 				"gridPos": map[string]interface{}{
// 					"x": float64(10),
// 					"y": float64(20),
// 					"h": float64(5),
// 					"w": float64(8),
// 				},
// 				"transparent": true,
// 				"options": map[string]interface{}{
// 					"custom": "value",
// 				},
// 			}

// 			applyPanelDefaults(panel)

// 			// Check that existing values are preserved
// 			assertEqual(t, "Test Panel", panel["title"])
// 			assertEqual(t, true, panel["transparent"])

// 			gridPos, ok := panel["gridPos"].(map[string]interface{})
// 			assertTrue(t, ok, "gridPos should exist")
// 			assertEqual(t, float64(10), gridPos["x"])
// 			assertEqual(t, float64(20), gridPos["y"])
// 			assertEqual(t, float64(5), gridPos["h"])
// 			assertEqual(t, float64(8), gridPos["w"])

// 			options, ok := panel["options"].(map[string]interface{})
// 			assertTrue(t, ok, "options should exist")
// 			assertEqual(t, "value", options["custom"])
// 		})

// 		t.Run("should ensure query IDs", func(t *testing.T) {
// 			panel := map[string]interface{}{
// 				"title": "Test Panel",
// 				"targets": []interface{}{
// 					map[string]interface{}{
// 						"expr": "up",
// 					},
// 					map[string]interface{}{
// 						"expr": "down",
// 					},
// 				},
// 			}

// 			applyPanelDefaults(panel)

// 			targets, ok := panel["targets"].([]interface{})
// 			assertTrue(t, ok, "targets should exist")
// 			assertEqual(t, 2, len(targets))

// 			// Check that refIds are assigned
// 			target1 := targets[0].(map[string]interface{})
// 			target2 := targets[1].(map[string]interface{})
// 			assertEqual(t, "A", target1["refId"])
// 			assertEqual(t, "B", target2["refId"])
// 		})
// 	})

// 	t.Run("Panel Cleanup Logic (getSaveModel mimic)", func(t *testing.T) {
// 		t.Run("should remove notPersistedProperties", func(t *testing.T) {
// 			panel := map[string]interface{}{
// 				"id":    float64(1),
// 				"title": "Test Panel",
// 				"type":  "timeseries",
// 				// These properties should be removed
// 				"events":                  "some events",
// 				"isViewing":               true,
// 				"isEditing":               false,
// 				"hasRefreshed":            true,
// 				"cachedPluginOptions":     map[string]interface{}{"key": "value"},
// 				"plugin":                  "some plugin",
// 				"queryRunner":             "some runner",
// 				"replaceVariables":        "some func",
// 				"configRev":               float64(1),
// 				"hasSavedPanelEditChange": true,
// 				"getDisplayTitle":         "some func",
// 				"dataSupport":             "some support",
// 				"key":                     "some key",
// 				"isNew":                   true,
// 				"refreshWhenInView":       true,
// 			}

// 			cleanupPanelForSave(panel)

// 			// Check that notPersistedProperties are removed
// 			assertMapDoesNotHaveKey(t, panel, "events")
// 			assertMapDoesNotHaveKey(t, panel, "isViewing")
// 			assertMapDoesNotHaveKey(t, panel, "isEditing")
// 			assertMapDoesNotHaveKey(t, panel, "hasRefreshed")
// 			assertMapDoesNotHaveKey(t, panel, "cachedPluginOptions")
// 			assertMapDoesNotHaveKey(t, panel, "plugin")
// 			assertMapDoesNotHaveKey(t, panel, "queryRunner")
// 			assertMapDoesNotHaveKey(t, panel, "replaceVariables")
// 			assertMapDoesNotHaveKey(t, panel, "configRev")
// 			assertMapDoesNotHaveKey(t, panel, "hasSavedPanelEditChange")
// 			assertMapDoesNotHaveKey(t, panel, "getDisplayTitle")
// 			assertMapDoesNotHaveKey(t, panel, "dataSupport")
// 			assertMapDoesNotHaveKey(t, panel, "key")
// 			assertMapDoesNotHaveKey(t, panel, "isNew")
// 			assertMapDoesNotHaveKey(t, panel, "refreshWhenInView")

// 			// Check that essential properties are preserved
// 			assertMapHasKey(t, panel, "id")
// 			assertMapHasKey(t, panel, "title")
// 			assertMapHasKey(t, panel, "type")
// 		})

// 		t.Run("should remove properties that match defaults", func(t *testing.T) {
// 			panel := map[string]interface{}{
// 				"id":    float64(1),
// 				"title": "Test Panel",
// 				"type":  "timeseries",
// 				// These properties match defaults and should be removed
// 				"gridPos": map[string]interface{}{
// 					"x": float64(0), "y": float64(0), "h": float64(3), "w": float64(6),
// 				},
// 				"targets": []interface{}{
// 					map[string]interface{}{"refId": "A"},
// 				},
// 				"cachedPluginOptions": map[string]interface{}{},
// 				"transparent":         false,
// 				"options":             map[string]interface{}{},
// 				"links":               []interface{}{},
// 				"transformations":     []interface{}{},
// 				"fieldConfig": map[string]interface{}{
// 					"defaults":  map[string]interface{}{},
// 					"overrides": []interface{}{},
// 				},
// 			}

// 			cleanupPanelForSave(panel)

// 			// Check that default properties are removed
// 			assertMapDoesNotHaveKey(t, panel, "gridPos")
// 			assertMapDoesNotHaveKey(t, panel, "targets")
// 			assertMapDoesNotHaveKey(t, panel, "cachedPluginOptions")
// 			assertMapDoesNotHaveKey(t, panel, "transparent")
// 			assertMapDoesNotHaveKey(t, panel, "options")
// 			assertMapDoesNotHaveKey(t, panel, "links")
// 			assertMapDoesNotHaveKey(t, panel, "transformations")
// 			assertMapDoesNotHaveKey(t, panel, "fieldConfig")

// 			// Check that essential properties are preserved
// 			assertMapHasKey(t, panel, "id")
// 			assertMapHasKey(t, panel, "type")
// 		})

// 		t.Run("should preserve properties that differ from defaults", func(t *testing.T) {
// 			panel := map[string]interface{}{
// 				"id":    float64(1),
// 				"title": "Test Panel",
// 				"type":  "timeseries",
// 				// These properties differ from defaults and should be preserved
// 				"gridPos": map[string]interface{}{
// 					"x": float64(10), "y": float64(20), "h": float64(5), "w": float64(8),
// 				},
// 				"transparent": true,
// 				"options": map[string]interface{}{
// 					"custom": "value",
// 				},
// 				"fieldConfig": map[string]interface{}{
// 					"defaults": map[string]interface{}{
// 						"unit": "bytes",
// 					},
// 					"overrides": []interface{}{},
// 				},
// 			}

// 			cleanupPanelForSave(panel)

// 			// Check that non-default properties are preserved
// 			assertMapHasKey(t, panel, "gridPos")
// 			assertMapHasKey(t, panel, "transparent")
// 			assertMapHasKey(t, panel, "options")
// 			assertMapHasKey(t, panel, "fieldConfig")

// 			// Check that essential properties are preserved
// 			assertMapHasKey(t, panel, "id")
// 			assertMapHasKey(t, panel, "title")
// 			assertMapHasKey(t, panel, "type")
// 		})

// 		t.Run("should handle nested panels cleanup", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Row Panel",
// 						"type":  "row",
// 						"panels": []interface{}{
// 							map[string]interface{}{
// 								"id":    float64(2),
// 								"title": "Nested Panel",
// 								"type":  "timeseries",
// 								// These should be removed
// 								"cachedPluginOptions": map[string]interface{}{},
// 								"transparent":         false,
// 								"options":             map[string]interface{}{},
// 							},
// 						},
// 					},
// 				},
// 			}

// 			cleanupDashboardForSave(dashboard)

// 			// Check that nested panel cleanup was applied
// 			panels := dashboard["panels"].([]interface{})
// 			rowPanel := panels[0].(map[string]interface{})
// 			nestedPanels := rowPanel["panels"].([]interface{})
// 			nestedPanel := nestedPanels[0].(map[string]interface{})

// 			// Check that default properties are removed from nested panel
// 			assertMapDoesNotHaveKey(t, nestedPanel, "cachedPluginOptions")
// 			assertMapDoesNotHaveKey(t, nestedPanel, "transparent")
// 			assertMapDoesNotHaveKey(t, nestedPanel, "options")

// 			// Check that essential properties are preserved
// 			assertMapHasKey(t, nestedPanel, "id")
// 			assertMapHasKey(t, nestedPanel, "title")
// 			assertMapHasKey(t, nestedPanel, "type")
// 		})
// 	})

// 	t.Run("Panel ID Management", func(t *testing.T) {
// 		t.Run("should preserve unique existing IDs", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Panel 1",
// 					},
// 					map[string]interface{}{
// 						"id":    float64(2),
// 						"title": "Panel 2",
// 					},
// 					map[string]interface{}{
// 						"id":    float64(3),
// 						"title": "Panel 3",
// 					},
// 				},
// 			}

// 			ensurePanelsHaveUniqueIds(dashboard)

// 			panels := getPanels(dashboard)
// 			assertEqual(t, 3, len(panels))

// 			// Check that IDs are preserved
// 			assertEqual(t, float64(1), panels[0]["id"])
// 			assertEqual(t, float64(2), panels[1]["id"])
// 			assertEqual(t, float64(3), panels[2]["id"])
// 		})

// 		t.Run("should assign new IDs for missing IDs", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Panel 1",
// 					},
// 					map[string]interface{}{
// 						"title": "Panel 2", // No ID
// 					},
// 					map[string]interface{}{
// 						"id":    float64(3),
// 						"title": "Panel 3",
// 					},
// 				},
// 			}

// 			ensurePanelsHaveUniqueIds(dashboard)

// 			panels := getPanels(dashboard)
// 			assertEqual(t, 3, len(panels))

// 			// Check that existing IDs are preserved
// 			assertEqual(t, float64(1), panels[0]["id"])
// 			assertEqual(t, float64(3), panels[2]["id"])

// 			// Check that missing ID gets assigned
// 			panel2ID := panels[1]["id"]
// 			assertTrue(t, panel2ID != nil, "Panel 2 should have an ID assigned")
// 			assertTrue(t, panel2ID != float64(1) && panel2ID != float64(3), "Panel 2 should have a unique ID")
// 		})

// 		t.Run("should resolve duplicate IDs", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Panel 1",
// 					},
// 					map[string]interface{}{
// 						"id":    float64(1), // Duplicate ID
// 						"title": "Panel 2",
// 					},
// 					map[string]interface{}{
// 						"id":    float64(3),
// 						"title": "Panel 3",
// 					},
// 				},
// 			}

// 			ensurePanelsHaveUniqueIds(dashboard)

// 			panels := getPanels(dashboard)
// 			assertEqual(t, 3, len(panels))

// 			// Check that first panel keeps its ID
// 			assertEqual(t, float64(1), panels[0]["id"])

// 			// Check that duplicate ID gets resolved
// 			panel2ID := panels[1]["id"]
// 			assertTrue(t, panel2ID != nil, "Panel 2 should have an ID assigned")
// 			assertTrue(t, panel2ID != float64(1) && panel2ID != float64(3), "Panel 2 should have a unique ID")

// 			// Check that third panel keeps its ID
// 			assertEqual(t, float64(3), panels[2]["id"])
// 		})

// 		t.Run("should handle nested panels", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Row Panel",
// 						"type":  "row",
// 						"panels": []interface{}{
// 							map[string]interface{}{
// 								"id":    float64(2),
// 								"title": "Nested Panel 1",
// 							},
// 							map[string]interface{}{
// 								"title": "Nested Panel 2", // No ID
// 							},
// 						},
// 					},
// 					map[string]interface{}{
// 						"id":    float64(3),
// 						"title": "Regular Panel",
// 					},
// 				},
// 			}

// 			ensurePanelsHaveUniqueIds(dashboard)

// 			panels := getPanels(dashboard)
// 			assertEqual(t, 4, len(panels)) // 1 row + 2 nested + 1 regular

// 			// Check that all panels have unique IDs
// 			ids := make(map[float64]bool)
// 			for _, panel := range panels {
// 				id, ok := panel["id"].(float64)
// 				assertTrue(t, ok, "Panel should have an ID")
// 				assertFalse(t, ids[id], "Panel ID should be unique")
// 				ids[id] = true
// 			}
// 		})
// 	})

// 	t.Run("Nested Panel Processing", func(t *testing.T) {
// 		t.Run("should process all nested panels", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Row Panel",
// 						"type":  "row",
// 						"panels": []interface{}{
// 							map[string]interface{}{
// 								"id":    float64(2),
// 								"title": "Nested Panel 1",
// 							},
// 							map[string]interface{}{
// 								"id":    float64(3),
// 								"title": "Nested Panel 2",
// 							},
// 						},
// 					},
// 				},
// 			}

// 			panels := getPanels(dashboard)
// 			assertEqual(t, 3, len(panels)) // 1 row + 2 nested

// 			// Check that all panels are included
// 			titles := []string{}
// 			for _, panel := range panels {
// 				if title, ok := panel["title"].(string); ok {
// 					titles = append(titles, title)
// 				}
// 			}
// 			assertContains(t, titles, "Row Panel")
// 			assertContains(t, titles, "Nested Panel 1")
// 			assertContains(t, titles, "Nested Panel 2")
// 		})

// 		t.Run("should apply defaults to nested panels", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Row Panel",
// 						"type":  "row",
// 						"panels": []interface{}{
// 							map[string]interface{}{
// 								"id":    float64(2),
// 								"title": "Nested Panel",
// 							},
// 						},
// 					},
// 				},
// 			}

// 			// Apply defaults to all panels
// 			panels := getPanels(dashboard)
// 			for _, panel := range panels {
// 				applyPanelDefaults(panel)
// 			}

// 			// Get panels again to check the result
// 			panels = getPanels(dashboard)
// 			nestedPanel := panels[1] // Second panel should be the nested one

// 			// Check that nested panel has all defaults applied
// 			assertMapHasKey(t, nestedPanel, "gridPos")
// 			assertMapHasKey(t, nestedPanel, "targets")
// 			assertMapHasKey(t, nestedPanel, "cachedPluginOptions")
// 			assertMapHasKey(t, nestedPanel, "transparent")
// 			assertMapHasKey(t, nestedPanel, "options")
// 			assertMapHasKey(t, nestedPanel, "links")
// 			assertMapHasKey(t, nestedPanel, "fieldConfig")
// 		})
// 	})

// 	t.Run("Integration Tests", func(t *testing.T) {
// 		t.Run("should mimic complete DashboardModel constructor flow with cleanup", func(t *testing.T) {
// 			dashboard := map[string]interface{}{
// 				"title": "Test Dashboard",
// 				"panels": []interface{}{
// 					map[string]interface{}{
// 						"id":    float64(1),
// 						"title": "Test Panel",
// 					},
// 					map[string]interface{}{
// 						"id":    float64(2),
// 						"title": "Row Panel",
// 						"type":  "row",
// 						"panels": []interface{}{
// 							map[string]interface{}{
// 								"title": "Nested Panel", // No ID
// 								"type":  "timeseries",
// 							},
// 						},
// 					},
// 				},
// 			}

// 			// Simulate the complete DashboardModel constructor flow
// 			// 1. Apply frontend defaults
// 			applyFrontendDefaults(dashboard)

// 			// 2. Apply panel defaults to all panels
// 			panels := getPanels(dashboard)
// 			for _, panel := range panels {
// 				applyPanelDefaults(panel)
// 			}

// 			// 3. Ensure unique panel IDs
// 			ensurePanelsHaveUniqueIds(dashboard)

// 			// 4. Clean up dashboard to match getSaveModel behavior
// 			cleanupDashboardForSave(dashboard)

// 			// Verify the result
// 			assertMapHasKey(t, dashboard, "editable")
// 			assertMapHasKey(t, dashboard, "annotations")
// 			assertMapHasKey(t, dashboard, "meta")

// 			panels = getPanels(dashboard)
// 			assertEqual(t, 3, len(panels)) // 1 regular + 1 row + 1 nested

// 			// Check that all panels have unique IDs
// 			ids := make(map[float64]bool)
// 			for _, panel := range panels {
// 				id, ok := panel["id"].(float64)
// 				assertTrue(t, ok, "Panel should have an ID")
// 				assertFalse(t, ids[id], "Panel ID should be unique")
// 				ids[id] = true
// 			}

// 			// Check that nested panel has defaults applied but cleanup removes unnecessary properties
// 			nestedPanel := panels[2] // Third panel should be the nested one
// 			assertMapHasKey(t, nestedPanel, "id")
// 			assertMapHasKey(t, nestedPanel, "title")
// 			assertMapHasKey(t, nestedPanel, "type")

// 			// Check that default properties that match defaults are removed
// 			assertMapDoesNotHaveKey(t, nestedPanel, "cachedPluginOptions")
// 			assertMapDoesNotHaveKey(t, nestedPanel, "transparent")
// 			assertMapDoesNotHaveKey(t, nestedPanel, "options")
// 		})
// 	})
// }
