
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import coreModule from '../core_module';

export interface ICoolButtonProps {
  count: number;
}

export interface ICoolButtonState {
  count: number;
}


export class CoolButton extends React.Component<ICoolButtonProps, ICoolButtonState> {

  constructor(props) {
    super(props);

    this.state = {count: 1};
  }

  onClick() {
    this.setState(prevState => ({
      count: prevState.count + 1
    }));
    console.log(this.state.count);
  }

  render() {
    return (
      <div>
        <h2 onClick={this.onClick.bind(this)}>Hello</h2>
        <div>{this.state.count}</div>
        <a href="/alerting">Go to alerting</a>
      </div>
    );
  }
}

export interface Props {
  fname: string;
  onClick: () => void;
}

function SecondButton({fname, onClick}: Props) {
  return (
    <div className="hello">
      <div className="greeting">
        Hello {fname}
      </div>
      <div>
        <button onClick={onClick}>button</button>
      </div>
    </div>
  );
}

coreModule.directive('coolButton', function(reactDirective) {
  return reactDirective(CoolButton);
});

coreModule.directive('secondButton', function(reactDirective) {
  return reactDirective(SecondButton, [
    ['fname', {watchDepth: 'value'}]
  ]);
});
