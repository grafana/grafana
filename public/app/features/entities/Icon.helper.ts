import { EntityProperties, AssertionEntityTypes } from './asserts-types';
import icomoonIconsPack from './assets/icomoon/selection.json';

export const getIconCodeByType = (type: string, properties?: EntityProperties) => {
  const processedType = properties ? getIconTypeByProperties(type, properties).toLowerCase() : type.toLowerCase();

  let iconObject = icomoonIconsPack.icons.find((i) => i.icon.tags.map((t) => t.toLowerCase()).includes(processedType));

  if (!iconObject) {
    // try to find by non-processed type
    iconObject = icomoonIconsPack.icons.find((i) =>
      i.icon.tags.map((t) => t.toLowerCase()).includes(type.toLowerCase())
    );
  }

  return iconObject?.properties.code;
};

export const getIconTypeByProperties = (type: string | number, properties: EntityProperties): string => {
  type = type.toString();
  if (type === AssertionEntityTypes.SERVICE) {
    const serviceType = properties['service_type'];
    const provider = properties['provider'];
    const propType = properties['asserts_subtype'];
    if (serviceType === 'Lambda' && provider === 'aws') {
      return 'lambdaaws';
    }
    if (serviceType === 'EBSVolume' && provider === 'aws') {
      return 'amazonelasticblock';
    }
    if (serviceType === 'EFSFileSystem' && provider === 'aws') {
      return 'amazonefs';
    }
    if (serviceType === 'S3Bucket' && provider === 'aws') {
      return 'amazonsss';
    }
    if (serviceType === 'RDS Instance' && provider === 'aws') {
      return 'amazonrds';
    }
    if (serviceType === 'DynamoDB Table' && provider === 'aws') {
      return 'amazondynamodb';
    }
    if (serviceType === 'EC2Instance' && provider === 'aws') {
      return 'amazonec2';
    }
    if (serviceType === 'ECS Service' && provider === 'aws') {
      return 'amazonelasticcontainer';
    }
    if (serviceType === 'ApiGateway' && provider === 'aws') {
      return 'amazonapigateway';
    }
    if (serviceType === 'Kinesis Stream' && provider === 'aws') {
      return 'amazonkinesis';
    }
    if (serviceType === 'Kinesis Firehose' && provider === 'aws') {
      return 'kinesisfirehose';
    }
    if (serviceType === 'Kinesis Analytics' && provider === 'aws') {
      return 'kinesisanalytics';
    }
    if (serviceType === 'SNSTopic' && provider === 'aws') {
      return 'amazonsns';
    }
    if (serviceType === 'NatGateway' && provider === 'aws') {
      return 'amazonvpcgateway';
    }
    if (serviceType === 'LoadBalancer' && provider === 'aws' && propType === 'app') {
      return 'elasticlbapplication';
    }
    if (serviceType === 'LoadBalancer' && provider === 'aws' && propType === 'net') {
      return 'elasticlbnetwork';
    }
    if (serviceType === 'LoadBalancer' && provider === 'aws') {
      return 'elasticlbclassic';
    }

    return (properties['service_type'] || '').toString() || type;
  }

  if (type === AssertionEntityTypes.ASSERTION) {
    return properties['asserts_alert_category']?.toString() || type;
  }

  if (type === AssertionEntityTypes.TOPIC) {
    if (properties && properties['service_type'] === 'SQSQueue') {
      return 'amazonsqs';
    }
  }

  return type;
};
