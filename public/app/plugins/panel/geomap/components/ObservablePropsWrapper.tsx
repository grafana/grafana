import React, { Component } from 'react';
import { Observable, Unsubscribable } from 'rxjs';

interface Props<T> {
  watch: Observable<T>;
  child: React.ComponentType<T>;
  initialSubProps: T;
}

interface State<T> {
  subProps: T;
}

export class ObservablePropsWrapper<T> extends Component<Props<T>, State<T>> {
  sub?: Unsubscribable;

  constructor(props: Props<T>) {
    super(props);
    this.state = {
      subProps: props.initialSubProps,
    };
  }

  componentDidMount() {
    console.log('ObservablePropsWrapper:subscribe');
    this.sub = this.props.watch.subscribe({
      next: (subProps: T) => {
        console.log('ObservablePropsWrapper:NEXT', subProps);
        this.setState({ subProps });
      },
      complete: () => {
        console.log('ObservablePropsWrapper:complete');
      },
      error: (err) => {
        console.log('ObservablePropsWrapper:error', err);
      },
    });
  }

  componentWillUnmount() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    console.log('ObservablePropsWrapper:unsubscribe');
  }

  render() {
    const { subProps } = this.state;
    console.log('RENDER (wrap)', subProps);
    return <this.props.child {...subProps} />;
  }
}
