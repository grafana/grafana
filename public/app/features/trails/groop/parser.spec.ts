import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { lookupNode } from './lookup';
import { Parser, prefixDelimited } from './parser';

describe('Parser', () => {
  const metrics = readFileSync(join(__dirname, 'testdata', 'metrics.txt'), 'utf8').split('\n');

  it('should parse strings and build a tree', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    expect(grouping.root.groups.has('agent')).toBe(true);
    const agentGroup = grouping.root.groups.get('agent')!;

    expect(agentGroup.descendants).toBe(41);

    expect(agentGroup.groups.size).toBe(3);
    expect(agentGroup.groups.has('agent_config')).toBe(true);
    expect(agentGroup.groups.has('agent_metrics')).toBe(true);
    expect(agentGroup.groups.has('agent_wal')).toBe(true);

    // get all keys from agentGroup.groups
    const groupKeys = Array.from(agentGroup.groups.keys());
    expect(groupKeys.length).toBe(3);
    expect(groupKeys[0]).toBe('agent_config');
    expect(groupKeys[1]).toBe('agent_metrics');
    expect(groupKeys[2]).toBe('agent_wal');

    // check the values
    expect(agentGroup.values.length).toBe(8);
    expect(agentGroup.values[0]).toBe('agent');
    expect(agentGroup.values[1]).toBe('agent_build_info');
    expect(agentGroup.values[2]).toBe('agent_inflight_requests');
    expect(agentGroup.values[3]).toBe('agent_request_duration_seconds');
    expect(agentGroup.values[4]).toBe('agent_request_message_bytes');
    expect(agentGroup.values[5]).toBe('agent_response_message_bytes');
    expect(agentGroup.values[6]).toBe('agent_tcp_connections');
    expect(agentGroup.values[7]).toBe('agent_tcp_connections_limit');
  });

  it('should put metrics that match the name of the group in that group', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const agentGroup = lookupNode(grouping.root, 'agent');
    expect(agentGroup).not.toBeNull();
    expect(agentGroup!.values.length).toBe(8);
    expect(agentGroup!.values[0]).toBe('agent');
  });

  it('should respect maxDepth', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    parser.config.maxDepth = 1;
    const grouping = parser.parse(metrics);

    const agentGroup = lookupNode(grouping.root, 'agent');
    expect(agentGroup).not.toBeNull();
    expect(agentGroup!.values.length).toBe(41);
  });

  it('should support misc for left-over values', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    parser.config.maxDepth = 1;
    parser.config.miscGroupKey = 'misc';
    const grouping = parser.parse(metrics);
    expect(grouping.root.descendants).toBe(1604);
    expect(grouping.root.values.length).toBe(0);

    const miscGroup = lookupNode(grouping.root, 'misc');
    expect(miscGroup).not.toBeNull();
    expect(miscGroup!.values.length).toBe(52);
    expect(miscGroup?.descendants).toBe(52);
  });
});

describe('prefixDelimited', () => {
  it('should return the prefix of a string', () => {
    expect(prefixDelimited('agent_metrics_ha_configs_created', 0)).toBe('agent');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 1)).toBe('agent_metrics');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 2)).toBe('agent_metrics_ha');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 3)).toBe('agent_metrics_ha_configs');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 4)).toBe('agent_metrics_ha_configs_created');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 5)).toBe('agent_metrics_ha_configs_created');
  });
});

describe('lots of strings', () => {
  const metrics = readFileSync(join(__dirname, 'testdata', 'metrics20k.txt'), 'utf8').split('\n');
  it('should parse 20k strings', () => {
    const now = performance.now();
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 50;
    parser.config.maxDepth = 1;
    const grouping = parser.parse(metrics);
    const elapsed = performance.now() - now;
    expect(grouping.root.descendants).toBe(19546);
    console.log(`${grouping.root.descendants} strings parsed in ${elapsed}ms`);
    // print all top level groups
    const topLevelGroups = Array.from(grouping.root.groups.keys());
    expect(topLevelGroups.join(', ')).toBe(
      `DCGM, access, adaptive, addsstable, adhoc, admin, admission, agent, aggregator, alertmanager, alloy, analytics, apiserver, apisix, app, argo, asserts, atlantis, auth, authentication, authorization, aws, backstage, base, billing, blackbox, block, bootstrapper, buffer, build, bytes, cache, capacity, celery, certmanager, changefeed, chatops, checked, citadel, cle, closers, cloud, cloudcost, cloudsql, cluster, code, commitlog, config, conntrack, container, context, controller, coordinator, coredns, cortex, counter, cronjob, crossplane, csi, database, datadog, db, dbindex, dbshard, descheduler, disk, distsender, dns, drone, ecs, encoder, endpoint, envoy, erlang, etcd, exec, executor, exporter, externalsecret, faro, fetch, field, flagger, flower, freetier, fs, galley, gatekeeper, gateway, gcom, gcommail, gcp, github, go, gorm, gossip, gotk, grafana, grafanacloud, grafanacom, graphite, grpc, hekate, hgapi, hgcontroller, hggateway, hikaricp, hosted, http, identifier, incident, index, influxdb, informer, instance, integrations, intentresolver, intents, istio, iterator, jaeger, java, jdbc, jmx, job, jobs, jvm, k6, k6cloud, k6stats, kafka, karpenter, keda, kepler, kine, kminion, konnectivity, kopia, kowalski, kube, kubecost, kubedns, kubelet, kubeproxy, kubernetes, kv, leases, legacy, liveness, llm, llmgateway, log, logql, logs, loki, m3dbclient, m3ninx, machine, memberlist, memcached, metadata, method, metrics, mimir, miner, ml, mlapi, mlops, mlscheduler, mlworker, modelapi, mt, mtgr, mtgrdns, multi, mysql, namespace, net, netfilter, network, nginx, node, nodejs, nodepool, objstore, oncall, orchestrator, otelcol, otlp, outbox, pdc, peers, pg, pgbouncer, pilot, pod, postgres, postings, postingslist, preempter, private, probe, process, processing, processor, profiles, prometheus, promhttp, promitor, promrun, promtail, proxy, pushgateway, pyroscope, pyroscopedb, python, querier, query, queue, rabbitmq, raft, range, ranges, rebalancing, redis, registry, replicas, replicaset, replication, request, requests, response, rest, retrieve, ring, rocket, rocksdb, rollout, root, round, rpc, rt, runtime, scc, scheduler, schedules, scrape, secret, security, segment, series, server, service, serviceaccount, sidecar, sift, sigma, skydns, slo, sm, smtprelay, spanconfig, spring, sql, sqlliveness, stack, stackdriver, storage, sys, system, tag, tags, tanka, telemetry, tempo, tempodb, tenant, test, thanos, timer, timeseries, tomcat, traces, traefik, ttl, txn, txnrecovery, txnwaitqueue, type, uninitialized, unused, update, usage, vault, vectorapi, velero, vendor, version, vllm, volume, vpa, warpstream, watch, watcher, webhook, wired, workload, workqueue, write, yace`
    );
  });
});
