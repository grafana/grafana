export const Messages = {
  pageTitle: 'Kubernetes Cluster',
  isEKSRadioTooltip: `If using Amazon EKS and kubeconfig does not contain AWS access key ID
  and AWS secret access key please provide them below`,
  awsAccessKeyIDLabel: 'AWS Access Key ID',
  awsSecretAccessKeyLabel: 'AWS Secret Access Key',
  awsAccessKeyIDTooltip: `AWS Access Key ID of the root user or an IAM user with access to the
  EKS cluster`,
  awsSecretAccessKeyTooltip: `AWS Secret Access Key of the root user or an IAM user with access
  to the EKS cluster`,
  fields: {
    clusterName: 'Kubernetes Cluster Name',
    kubeConfig: 'Kubeconfig file',
  },
  paste: 'Paste from clipboard',
  genericRadioButton: 'Generic',
  eksRadioButton: 'Amazon Elastic Kubernetes\nService',
};
