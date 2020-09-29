import React, { FC, useEffect, useState } from 'react';
import { Scene, SceneElement, SceneViz } from './state/models';

export interface Props {
  model: Scene;
}

export const SceneView: FC<Props> = ({ model }) => {
  const [elements, setElements] = useState<SceneElement[]>([]);

  useEffect(() => {
    const subscription = model.elements.subscribe({
      next: scene => setElements(scene),
    });

    return subscription.unsubscribe;
  }, []);

  return (
    <div>
      <div>{model.title}</div>
      <div>
        {elements.map(item => (
          <SceneElementView model={item} />
        ))}
      </div>
    </div>
  );
};

const SceneElementView: FC<{ model: SceneElement }> = ({ model }) => {
  switch (model.type) {
    case 'viz':
      return <SceneVizView model={model} />;
    case 'scene':
      return <SceneView model={model} />;
  }
};

const SceneVizView: FC<{ model: SceneViz }> = ({ model }) => {
  return <h2>Visualization: {model.title}</h2>;
};
