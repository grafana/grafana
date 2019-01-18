import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import NamedColorsPalette from './NamedColorsPalette';
import { getColorName } from '@grafana/ui/src/utils/colorsPalette';
import { withKnobs, select } from '@storybook/addon-knobs';

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

  static getDerivedStateFromProps(props: StateHolderProps<{}>, state: { value: {} }) {
    return {
      value: props.initialState,
      ...state
    };
  }

  handleStateUpdate = (nextState: T) => {
    this.setState({ value: nextState });
  };
  render() {
    return this.props.children(this.state.value, this.handleStateUpdate);
  }
}

storiesOf('UI/NamedColorsPalette', module)
  .addDecorator(withKnobs)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .add('Named colors swatch - support for named colors', () => {
    const selectedColor = select(
      'Selected color',
      {
        Green: 'green',
        Red: 'red',
        'Light blue': 'light-blue',
      },
      'green'
    );

    return (
      <UseState initialState={selectedColor}>
        {(selectedColor, updateSelectedColor) => {
          return (
            <NamedColorsPalette
              color={selectedColor}
              onChange={updateSelectedColor}
            />
          );
        }}
      </UseState>
    );
  })
  .add('Named colors swatch - support for hex values', () => {
    return (
      <UseState initialState="#00ff00">
        {(selectedColor, updateSelectedColor) => {
          return (
            <NamedColorsPalette
              color={getColorName(selectedColor)}
              onChange={updateSelectedColor}
            />
          );
        }}
      </UseState>
    );
  });
