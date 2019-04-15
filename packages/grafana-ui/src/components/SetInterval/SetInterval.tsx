import { PureComponent } from 'react';
import { stringToMs } from '../../utils/string';

interface Props {
  func: () => any; // TODO
  interval: string;
}

export class SetInterval extends PureComponent<Props> {
  private intervalId = 0;

  componentDidMount() {
    this.addInterval();
  }

  componentDidUpdate(prevProps: Props) {
    const { interval } = this.props;
    if (interval !== prevProps.interval) {
      this.clearInterval();
      this.addInterval();
    }
  }

  componentWillUnmount() {
    this.clearInterval();
  }

  addInterval = () => {
    const { func, interval } = this.props;

    if (interval) {
      func().then(() => {
        if (interval) {
          this.intervalId = window.setTimeout(() => {
            this.addInterval();
          }, stringToMs(interval));
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
