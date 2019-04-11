import { PureComponent } from 'react';
interface Props {
  func: () => any; // TODO
  delay: number;
}

export class SetInterval extends PureComponent<Props> {
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
    if (delay > 0) {
      func().then(() => {
        if (delay > 0) {
          // Need to re-check in case the promise (query) is slow
          this.intervalId = window.setTimeout(() => {
            this.addInterval();
          }, delay);
        }
      });
    }
  };

  clearInterval = () => {
    window.clearTimeout(this.intervalId);
  };

  render() {
    return null;
  }
}
