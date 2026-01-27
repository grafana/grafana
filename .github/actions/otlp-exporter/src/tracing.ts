import {detectResources, envDetector} from "@opentelemetry/resources";
import {BasicTracerProvider, BatchSpanProcessor} from "@opentelemetry/sdk-trace-base";
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-proto";
import { trace } from "@opentelemetry/api";
import assert from "assert";

let traceProvider: BasicTracerProvider | null = null;

export function initTracing(): void {
    traceProvider = new BasicTracerProvider({
        resource: detectResources({ detectors: [envDetector] }),
        spanProcessors: [
          new BatchSpanProcessor(new OTLPTraceExporter({}))
        ]
    });
    const result = trace.setGlobalTracerProvider(traceProvider);
    assert(result, "Failed to set global tracer provider");
}

export async function shutdownTracing(): Promise<void> {
    if (traceProvider) {
        console.log("Flushing traces...");
        await traceProvider.forceFlush();
        await traceProvider.shutdown();
        console.log("Tracing shut down");
    }
}
