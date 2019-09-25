import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Modal } from './Modal';

const ModalStories = storiesOf('UI/Modal', module);

ModalStories.addDecorator(withCenteredStory);

RefreshSelectStories.add('default', () => {
  return (
    <Modal title="My modal" icon="fa-share-square-o">
      Id incididunt do pariatur qui labore. Sint culpa irure cillum et ullamco proident. Deserunt ipsum velit dolore est
      enim proident dolore consectetur. Et cillum tempor pariatur et. Est tempor cillum ad id nulla. Cillum ut proident
      magna do cillum consequat reprehenderit excepteur. Pariatur culpa id excepteur reprehenderit consequat qui qui sit
      consectetur esse enim mollit incididunt. Ea excepteur nisi mollit reprehenderit eiusmod tempor. Eiusmod incididunt
      occaecat velit consectetur dolor cillum anim commodo fugiat cupidatat ut tempor officia. Aliquip fugiat occaecat
      excepteur consectetur ullamco consectetur exercitation occaecat sint sint incididunt cillum minim. Sint aliquip ea
      pariatur anim. Veniam laboris mollit in voluptate exercitation sint deserunt dolor ullamco ex dolor. Enim
      reprehenderit ut Lorem aliquip est laborum in. Aliqua in ut aute elit nulla amet. Ex proident pariatur ex in
      aliquip. Labore eu Lorem sint aliqua reprehenderit ipsum veniam aliquip laborum dolor deserunt cupidatat velit
      amet.
    </Modal>
  );
});
