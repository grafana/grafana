import React, { PureComponent } from 'react';

import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { EditorTabBody } from './EditorTabBody';

import { PanelModel } from '../state/PanelModel';
import './../../panel/GeneralTabCtrl';
import { GeneralTabReference } from './GeneralTabReference';

interface Props {
  panel: PanelModel;
  onReferenceChanged: () => void;
}

export class GeneralTab extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const { panel } = this.props;

    const loader = getAngularLoader();
    const template = '<panel-general-tab />';
    const scopeProps = {
      ctrl: {
        panel: panel,
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  render() {
    const { panel, onReferenceChanged } = this.props;

    return (
      <EditorTabBody heading="General" toolbarItems={[]}>
        <>
          <div ref={element => (this.element = element)} />

          <GeneralTabReference panel={panel} onReferenceChanged={onReferenceChanged} />
        </>
      </EditorTabBody>
    );
  }
}
