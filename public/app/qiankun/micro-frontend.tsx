import ReactDOM from 'react-dom';

import './public-path';
import app from '../app';
// import App from './App'

export async function bootstrap() {
  console.log('grafana:bootstraped');
}

export async function mount(props) {
  props.onGlobalStateChange(async () => {
    props.setLoading(false);
  }, true);
  console.log('grafana:mount');
  app.init(props.container.querySelector('#reactRoot'));
}

export async function unmount(props) {
  ReactDOM.unmountComponentAtNode(
    props.container ? props.container.querySelector('#reactRoot') : document.querySelector('#root')
  );
}
