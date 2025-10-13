import { action } from '@storybook/addon-actions';
import { StoryFn, Meta } from '@storybook/react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { Stack } from '../Layout/Stack/Stack';

import { Alert, AlertVariant } from './Alert';
import mdx from './Alert.mdx';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: Meta<typeof Alert> = {
  title: 'Overlays/Alert/Toast',
  component: Alert,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['onRemove'] },
  },
  argTypes: {
    severity: { control: { type: 'select', options: severities } },
  },
  args: {
    title: 'Toast',
    severity: 'error',
    onRemove: action('Remove button clicked'),
  },
};

export const Basic: StoryFn<typeof Alert> = (args) => {
  return (
    <Alert {...args} elevated>
      Child content that includes some alert details, like maybe what actually happened.
    </Alert>
  );
};

export function Examples() {
  return (
    <Stack direction="column">
      <StoryExample name="Severities">
        <Stack direction="column">
          {severities.map((severity) => (
            <Alert
              title={`Severity: ${severity}`}
              severity={severity}
              key={severity}
              onRemove={action('Remove button clicked')}
              elevated={true}
            />
          ))}
        </Stack>
      </StoryExample>
      <StoryExample name="With huge payload">
        <Alert title="Alert with huge payload" severity="error" elevated={true}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam metus urna, aliquam eu scelerisque non,
          facilisis eget est. Morbi eleifend egestas massa id vulputate. Fusce dignissim magna lacus, ut molestie odio
          feugiat sed. Cras fringilla justo sit amet turpis scelerisque, a volutpat purus iaculis. Nunc sagittis
          molestie faucibus. Curabitur at neque luctus, pellentesque urna eget, posuere urna. Nunc malesuada elit in
          ipsum dictum egestas. Praesent convallis mauris massa, porta mattis ex gravida ut. Proin consectetur ultrices
          tortor sit amet efficitur. Suspendisse nec turpis dapibus mauris venenatis maximus quis eget orci. Ut semper
          enim magna, ullamcorper elementum sapien pharetra vitae. Vivamus at nulla ut metus bibendum ornare et ut leo.
          Proin ante turpis, ornare a malesuada et, rutrum nec lorem. Maecenas vestibulum orci vel nibh convallis
          eleifend. Quisque vitae consectetur massa, vitae elementum mauris. Pellentesque sit amet ligula lorem. Fusce
          sit amet lorem non augue rutrum varius. Donec sed imperdiet libero, eget venenatis elit. Fusce porttitor
          dapibus urna. Duis fringilla ante vel tempor tincidunt. In euismod vestibulum odio sit amet iaculis. Donec vel
          dapibus libero. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi lacinia commodo lectus. Aenean
          in magna eget lectus luctus suscipit et vitae erat. Pellentesque quis ligula id lorem egestas sollicitudin sit
          amet sed sem. Nullam et nibh a odio rhoncus efficitur sed nec est. Sed commodo lacus vitae sem congue,
          accumsan dignissim metus iaculis. Praesent in dignissim nisl. Aliquam facilisis, sapien eget porttitor
          ultrices, massa libero bibendum odio, at ornare diam arcu ac massa. Vestibulum egestas leo eget lorem congue
          condimentum. Praesent egestas, neque id gravida vehicula, augue ex scelerisque lectus, finibus pellentesque
          enim dolor vel ante. Cras convallis, sem at malesuada tincidunt, diam urna auctor leo, sed laoreet est ex in
          libero. Ut condimentum ante eget ex gravida, id tempus metus ultricies. Pellentesque placerat, massa id
          laoreet molestie, justo nisl varius metus, maximus vehicula erat libero vitae nulla. Mauris rhoncus ligula
          vitae volutpat auctor. Suspendisse potenti. Quisque quis orci faucibus, ullamcorper dolor eget, mollis massa.
          Etiam eu molestie ipsum. Sed laoreet diam metus, luctus maximus erat viverra quis. Ut eu felis dictum,
          tincidunt erat sit amet, scelerisque neque. Orci varius natoque penatibus et magnis dis parturient montes,
          nascetur ridiculus mus. Phasellus sit amet est tristique, fermentum massa ut, viverra metus. Interdum et
          malesuada fames ac ante ipsum primis in faucibus. Nunc iaculis nunc elit, ut feugiat ipsum egestas eget.
          Vestibulum pulvinar ligula mi, quis lacinia diam suscipit eget. Etiam consectetur vel nunc at hendrerit.
          Pellentesque blandit eleifend aliquam. Etiam et malesuada purus, et bibendum sapien. Phasellus tincidunt
          consequat eros consequat sodales. Vestibulum quis viverra neque. Integer sit amet lacinia nunc. Ut cursus,
          elit id faucibus elementum, elit nunc dapibus tellus, non ornare nisi sapien et eros. Nunc sit amet suscipit
          arcu. Nulla ut nunc tempor, auctor massa sed, consectetur orci. Pellentesque erat ante, placerat eget dictum
          elementum, dapibus et ipsum. Nunc sit amet nulla gravida, finibus felis vel, tempus sem. In urna purus,
          accumsan quis aliquam et, condimentum ac urna. Nullam volutpat ullamcorper sapien, quis ultricies purus
          dignissim aliquam. Mauris quis enim ante. Etiam vulputate faucibus placerat. Ut pellentesque, purus vitae
          euismod cursus, lacus enim vulputate sapien, in porttitor erat dui eu lectus. Duis eleifend, massa vel
          vehicula gravida, magna urna rutrum ligula, vitae mollis ipsum neque id enim. Donec varius tristique nisi, et
          vestibulum dolor efficitur eget. Cras mauris leo, bibendum eget pretium a, tincidunt faucibus massa.
          Vestibulum hendrerit arcu magna, vel consequat est euismod nec. Vestibulum non lacus porttitor, congue tortor
          ut, venenatis elit. Duis at lectus arcu. Nunc quis sapien eu ipsum rutrum accumsan. Orci varius natoque
          penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vivamus quis sapien luctus, volutpat nulla
          eget, gravida nunc. Aenean placerat a felis quis imperdiet. Sed sapien tellus, ultrices non ipsum eget,
          pretium rhoncus quam. Aliquam erat volutpat. Maecenas at interdum turpis, eu mattis ligula. Class aptent
          taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In lobortis felis a leo
          ultricies, venenatis mollis felis lobortis. Suspendisse placerat vel ante vel euismod. Aenean sit amet
          ullamcorper mauris, id consectetur est. Ut ultricies enim non quam condimentum, et congue arcu commodo.
          Praesent convallis eleifend turpis, vitae feugiat turpis imperdiet sit amet. Class aptent taciti sociosqu ad
          litora torquent per conubia nostra, per inceptos himenaeos. Quisque vulputate porttitor mattis. Pellentesque
          sed ullamcorper lectus. Suspendisse velit tortor, viverra eget facilisis condimentum, accumsan sit amet felis.
          Cras lobortis mi fermentum ligula consectetur, vitae tincidunt mauris scelerisque. Aenean ac condimentum erat,
          quis lacinia lacus. Ut magna nibh, tempor et ligula suscipit, placerat laoreet ipsum. In semper semper nisl.
          Donec risus lorem, tempor sed sollicitudin vitae, fringilla et mi. Vivamus pulvinar quam nisl, et tincidunt
          justo tempus quis. Duis semper magna nunc, vitae faucibus lectus facilisis sed. Phasellus consequat arcu vel
          interdum fermentum. In condimentum euismod neque, sed aliquet mauris posuere nec. Etiam metus eros,
          pellentesque eget scelerisque id, porttitor at ligula. Curabitur eget nibh maximus enim lobortis sodales.
          Etiam vulputate ligula lobortis vestibulum pulvinar. Curabitur eros justo, accumsan sed elit ac, mattis
          lacinia nisi. Suspendisse ullamcorper lectus sit amet tellus condimentum porttitor. Duis cursus, neque et
          aliquam congue, odio lectus porta elit, id lacinia dolor justo non leo. Aliquam vehicula at tellus ullamcorper
          tincidunt. Phasellus neque nibh, convallis sit amet arcu sit amet, convallis egestas tortor. Etiam sit amet
          vehicula quam. Praesent id consequat lacus, ac facilisis quam. Integer tristique lorem eros, id consequat
          lorem lobortis vitae. Aliquam luctus purus eget sem molestie iaculis. Duis nisl risus, sodales sit amet nunc
          vitae, volutpat cursus augue. Pellentesque congue massa eu metus pellentesque consectetur at vel neque. Donec
          bibendum hendrerit erat, vitae dictum enim lobortis a. Quisque ac dapibus tellus, sit amet facilisis orci.
          Cras pretium tortor non condimentum semper. Phasellus mollis condimentum blandit. Pellentesque at arcu risus.
          Vivamus sit amet dui semper, suscipit est nec, elementum arcu. Praesent ante turpis, convallis ac leo eget,
        </Alert>
      </StoryExample>
    </Stack>
  );
}

export default meta;
