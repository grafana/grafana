// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { PureComponent } from 'react';

import { Trans } from '@grafana/i18n';

import TNil from '../../../types/TNil';

import DividerDemo from './DividerDemo';
import RegionDemo from './RegionDemo';

import './DraggableManagerDemo.css';

export type DraggableManagerDemoState = {
  dividerPosition: number;
  regionCursor: number | TNil;
  regionDragging: [number, number] | TNil;
};

export default class DraggableManagerDemo extends PureComponent<{}, DraggableManagerDemoState> {
  state: DraggableManagerDemoState;

  constructor(props: {}) {
    super(props);
    this.state = {
      dividerPosition: 0.25,
      regionCursor: null,
      regionDragging: null,
    };
  }

  _updateState = (nextState: {}) => {
    this.setState(nextState);
  };

  render() {
    const { dividerPosition, regionCursor, regionDragging } = this.state;
    return (
      <div className="DraggableManagerDemo">
        <h1>
          <Trans i18nKey="explore.draggable-manager-demo.draggable-manager-demo">DraggableManager demo</Trans>
        </h1>
        <section className="DraggableManagerDemo--scenario">
          <h2>
            <Trans i18nKey="explore.draggable-manager-demo.dragging-a-divider">Dragging a divider</Trans>
          </h2>
          <p>
            <Trans i18nKey="explore.draggable-manager-demo.click-and-drag-gray-divider">
              Click and drag the gray divider in the colored area, below.
            </Trans>
          </p>
          <p>
            <Trans i18nKey="explore.draggable-manager-demo.value" values={{ dividerPos: dividerPosition.toFixed(3) }}>
              Value: {'{{ dividerPos }}'}
            </Trans>
          </p>
          <div className="DraggableManagerDemo--realm">
            <DividerDemo position={dividerPosition} updateState={this._updateState} />
          </div>
        </section>
        <section className="DraggableManagerDemo--scenario">
          <h2>
            <Trans i18nKey="explore.draggable-manager-demo.dragging-a-sub-region">Dragging a sub-region</Trans>
          </h2>
          <p>
            <Trans i18nKey="explore.draggable-manager-demo.click-horizontally-somewhere-colored-below">
              Click and drag horizontally somewhere in the colored area, below.
            </Trans>
          </p>
          <p>
            <Trans
              i18nKey="explore.draggable-manager-demo.drag-value"
              values={{ dragValue: regionDragging && regionDragging.map((n) => n.toFixed(3)).join(', ') }}
            >
              Value: {'{{dragValue}}'}
            </Trans>
          </p>
          <div className="DraggableManagerDemo--realm">
            <RegionDemo regionCursor={regionCursor} regionDragging={regionDragging} updateState={this._updateState} />
          </div>
        </section>
      </div>
    );
  }
}
