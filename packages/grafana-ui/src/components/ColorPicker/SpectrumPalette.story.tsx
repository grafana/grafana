import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import SpectrumPalette from './SpectrumPalette';
import { withKnobs, select } from '@storybook/addon-knobs';
import { GrafanaTheme } from '../../types';

const CenteredStory: FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
        height: '100vh  ',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

interface StateHolderProps<T> {
  initialState: T;
  children: (currentState: T, updateState: (nextState: T) => void) => JSX.Element;
}

export class UseState<T> extends React.Component<StateHolderProps<T>, { value: T }> {
  constructor(props: StateHolderProps<T>) {
    super(props);
    this.state = {
      value: props.initialState,
    };
  }

  handleStateUpdate = (nextState: T) => {
    this.setState({ value: nextState });
  };
  render() {
    return this.props.children(this.state.value, this.handleStateUpdate);
  }
}

storiesOf('UI/SpectrumPalette', module)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .addDecorator(withKnobs)
  .add('Named colors swatch - support for named colors', () => {
    const selectedTheme = select(
      'Theme',
      {
        Light: GrafanaTheme.Light,
        Dark: GrafanaTheme.Dark,
      },
      GrafanaTheme.Light
    );
    return (
      <UseState initialState="red">
        {(selectedColor, updateSelectedColor) => {
          return <SpectrumPalette theme={selectedTheme} color={selectedColor} onChange={updateSelectedColor} />;
        }}
      </UseState>
    );
  });
