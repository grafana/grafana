import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';

import { VariableIdentifier, VariablePayload } from '../state/actions';
import { subscribeToVariableChanges } from '../subscribeToVariableStateChanges';
import { variableAdapters } from './index';
import { VariableEditor } from '../editor/VariableEditor';
import { VariableState } from '../state/types';

export interface VariableRendererProps extends VariableIdentifier {
  componentType: 'picker' | 'editor';
}

export class VariableRenderer extends PureComponent<VariableRendererProps, VariableState> {
  private readonly subscription: Subscription | null = null;
  constructor(props: VariableRendererProps) {
    super(props);

    // editing a new variable
    if (!props.uuid) {
      const initialState = variableAdapters
        .get(props.type)
        .reducer((undefined as unknown) as VariableState, { type: '', payload: {} as VariablePayload<any> });
      this.state = initialState;
    } else {
      this.subscription = subscribeToVariableChanges<VariableState>(props).subscribe({
        next: state => {
          if (this.state) {
            this.setState({ ...state });
            return;
          }

          this.state = state;
        },
      });
    }
  }

  componentWillUnmount(): void {
    this.subscription?.unsubscribe();
  }

  render() {
    const { type, componentType } = this.props;
    if (!variableAdapters.contains(type)) {
      return null;
    }

    if (componentType === 'picker') {
      const ComponentToRender = variableAdapters.get(type).picker;
      if (!ComponentToRender) {
        return null;
      }

      return <ComponentToRender {...this.state} />;
    }

    return <VariableEditor {...this.state} />;
  }
}
