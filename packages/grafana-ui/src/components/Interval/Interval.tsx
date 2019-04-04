import { PureComponent } from 'react';
interface Props {
  func: () => any; // TODO
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

    func().then(() => {
      this.intervalId = window.setTimeout(() => {
        this.addInterval();
      }, delay);
    });
  };

  clearInterval = () => {
    window.clearInterval(this.intervalId);
  };

  render() {
    return null;
  }
}
