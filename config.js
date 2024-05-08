const Joi = require('joi');

const schema = Joi.object({
    serviceName: Joi.string().default('grafana-x'),
    port: Joi.number().default(3333),
});

module.exports = { schema };
