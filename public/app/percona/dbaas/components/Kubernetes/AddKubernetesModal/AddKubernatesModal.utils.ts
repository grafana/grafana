import { parse } from 'yaml';

import { KubeConfig, Cluster } from '../Kubernetes.types';

export const onKubeConfigValueChange = (
  value: string | undefined,
  updateFormMutator: (configValue: string | undefined, nameValue: string | undefined) => void
) => {
  const defaultName = getClusterNameFromKubeConfig(value);
  updateFormMutator(value, defaultName);
};

const getClusterNameFromKubeConfig = (value: string | undefined): string | undefined => {
  if (value) {
    try {
      const parsedYAML: KubeConfig = parse(value);
      const clusters = parsedYAML?.clusters;
      if (clusters && clusters.length) {
        const clusterWithName = clusters.find((item: Cluster) => item?.name != null);
        if (clusterWithName) {
          return clusterWithName.name;
        }
      }
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
};

const getFromClipboard = async () => {
  if (navigator.clipboard.readText) {
    return navigator.clipboard.readText();
  }
  return Promise.resolve(undefined);
};

export const pasteFromClipboard = async (
  updateFormMutator: (configValue: string | undefined, nameValue: string | undefined) => void
) => {
  const kubeConfig = await getFromClipboard();
  if (kubeConfig) {
    const defaultName = getClusterNameFromKubeConfig(kubeConfig);
    updateFormMutator(kubeConfig, defaultName);
  }
};
