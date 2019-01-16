import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import  NamedColorsPicker  from './NamedColorsPicker';
import { Color, getColorName } from '@grafana/ui/src/utils/colorsPalette';

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

class UseState<T> extends React.Component<StateHolderProps<T>, {value: T}> {
  constructor(props: StateHolderProps<T>) {
    super(props)
    this.state = {
      value: props.initialState
    }
  }
  handleStateUpdate = (nextState: T) => {
    this.setState({value: nextState})
  }
  render() {
    return this.props.children(this.state.value, this.handleStateUpdate)
  }
}

storiesOf('UI/ColorPicker', module)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .add('Named colors swatch - support for named colors', () => {
    return(
       <UseState initialState="green">
         {(selectedColor, updateSelectedColor) => {
            return (
              <NamedColorsPicker
                selectedColor={selectedColor as Color}
                onChange={(color) => { updateSelectedColor(color.name);}}
              />
            )
         }}
       </UseState>);
  })
  .add('Named colors swatch - support for hex values', () => {
    return(
       <UseState initialState="#00ff00">
         {(selectedColor, updateSelectedColor) => {
            return (
              <NamedColorsPicker
                selectedColor={getColorName(selectedColor)}
                onChange={(color) => updateSelectedColor(color.variants.dark)}
              />
            )
         }}
       </UseState>);
  });
