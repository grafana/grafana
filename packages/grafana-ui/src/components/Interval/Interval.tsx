import { PureComponent } from 'react';

interface Props {
  func: () => void;
  delay: number;
}

export class Interval extends PureComponent<Props> {
  private intervalId = 0;

  componentDidMount() {
    this.addInterval();
  }

  componentDidUpdate(prevProps: Props) {
    const { delay } = this.props;
    if (delay !== prevProps.delay) {
      this.clearInterval();
      this.addInterval();
    }
  }

  componentWillUnmount() {
    this.clearInterval();
  }

  addInterval = () => {
    const { func, delay } = this.props;
    if (delay && delay > 0) {
      this.intervalId = window.setInterval(func, delay);
    }
  };

  clearInterval = () => {
    window.clearInterval(this.intervalId);
  };

  render() {
    return null;
  }
}
