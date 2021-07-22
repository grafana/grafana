import React, { PureComponent } from 'react';
import { Observable, Unsubscribable } from 'rxjs';

interface Props<T> {
  watch: Observable<T>;
  child: React.ComponentType<T>;
  initialSubProps: T;
}

interface State<T> {
  subProps: T;
}

export class ObservablePropsWrapper<T> extends PureComponent<Props<T>, State<T>> {
  sub?: Unsubscribable;

  constructor(props: Props<T>) {
    super(props);
    this.state = {
      subProps: props.initialSubProps,
    };
  }

  componentDidMount() {
    this.sub = this.props.watch.subscribe({
      next: (subProps: T) => {
        console.log('NEXT', subProps);
        this.setState({ subProps });
      },
    });
  }

  componentWillUnmount() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  render() {
    const { subProps } = this.state;
    console.log('RENDER (wrap)', subProps);
    return <this.props.child {...subProps} />;
  }
}
