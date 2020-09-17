import { ChannelSupport, ChannelHandler } from '@grafana/data';
import {
  SubscribeSuccessContext,
  UnsubscribeContext,
  JoinLeaveContext,
  SubscribeErrorContext,
} from 'centrifuge/dist/centrifuge.protobuf';

const noisyHandler: ChannelHandler = {
  onSubscribe: (context: SubscribeSuccessContext) => {
    console.log('onSubscribe', context);
  },

  onUnsubscribe: (context: UnsubscribeContext) => {
    console.log('onUnsubscribe', context);
  },

  onError: (context: SubscribeErrorContext) => {
    console.log('onError', context);
  },

  onJoin: (context: JoinLeaveContext) => {
    console.log('onJoin', context);
  },

  onLeave: (context: JoinLeaveContext) => {
    console.log('onLeave', context);
  },
};

export const testDataChannelSupport: ChannelSupport = {
  getChannelHandler: (path: string) => {
    if (path === 'random-2s-stream') {
      return noisyHandler;
    }
    if (path === 'random-flakey-stream') {
      return noisyHandler;
    }
    throw new Error('unsupported channel');
  },

  getChannels: () => [
    {
      path: 'random-2s-stream',
      description: 'Random walk with a point every 2 seconds',
    },
    {
      path: 'random-flakey-stream',
      description: 'intermittant stream with points .5-4x/sec',
    },
  ],
};
