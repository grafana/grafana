import React from 'react'; // ✅ Import React explicitly
import { EmbeddedScene, SceneFlexLayout, SceneFlexItem, PanelBuilders } from '@grafana/scenes';
import StockChart from '../StockChart'; // ✅ Import StockChart component

export function helloWorldScene() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      children: [
        // Text Panel
        new SceneFlexItem({
          width: '100%',
          height: 100,
          body: PanelBuilders.text()
            .setTitle('Hello World Panel')
            .setOption('content', 'Welcome to Stock Anomaly Detection')
            .build(),
        }),

        // Stock Chart Panel (✅ Using PanelBuilders.react() instead of ReactPanel)
       
      ],
    }),
  });
}
