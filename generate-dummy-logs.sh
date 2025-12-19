#!/bin/bash

# Script to generate dummy logs and send them to VictoriaLogs
# VictoriaLogs endpoint
VICTORIALOGS_URL="http://localhost:9428/insert/jsonline?_stream_fields=service,host"

# Log levels
LOG_LEVELS=("INFO" "WARN" "ERROR" "DEBUG" "TRACE")

# Services
SERVICES=("payment-service" "ai-classification" "api-gateway" "database-pool" "cache-service" "kafka-consumer" "auth-service" "job-executor")

# Categories for AI classification
CATEGORIES=("search" "analytics" "recommendation" "classification")
INTENTS=("find_data" "analyze_trends" "get_suggestions" "categorize_content")

# HTTP methods and paths
HTTP_METHODS=("GET" "POST" "PUT" "DELETE" "PATCH")
HTTP_PATHS=("/api/v1/users" "/api/v1/orders" "/api/v2/products" "/api/v1/analytics" "/graphql")

# Cache operations
CACHE_OPS=("GET" "SET" "DELETE" "EXPIRE")

# Job statuses
JOB_STATUSES=("SUCCESS" "FAILED" "RUNNING" "PENDING")

# Hosts
HOSTS=("host-1" "host-2" "host-3" "host-4")

# Regions
REGIONS=("us-east-1" "us-west-2" "eu-central-1" "ap-southeast-1")

echo "Starting to generate dummy logs..."
echo "Sending logs to: $VICTORIALOGS_URL"
echo "Press Ctrl+C to stop"
echo ""

# Counter for logs sent
COUNT=0

# Generate logs continuously
while true; do
  # Random selections
  LEVEL=${LOG_LEVELS[$RANDOM % ${#LOG_LEVELS[@]}]}
  SERVICE=${SERVICES[$RANDOM % ${#SERVICES[@]}]}
  HOST=${HOSTS[$RANDOM % ${#HOSTS[@]}]}
  REGION=${REGIONS[$RANDOM % ${#REGIONS[@]}]}

  # Generate timestamp in RFC3339 format
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

  # Generate random trace_id and span_id
  TRACE_ID=$(openssl rand -hex 16)
  SPAN_ID=$(openssl rand -hex 8)

  # Generate random user_id
  USER_ID=$((RANDOM % 10000))

  # Generate realistic log message based on service
  case $SERVICE in
    "payment-service")
      TOTAL_PAGES=$((RANDOM % 10 + 1))
      TOTAL_ELEMENTS=$((RANDOM % 100 + 1))
      NUM_ELEMENTS=$((RANDOM % 50 + 1))
      NUMBER=$((RANDOM % 10))
      MESSAGE="com.bigcompany.payment.dao.PaymentService - Payment Service returned result: Total Pages $TOTAL_PAGES, Total Elements $TOTAL_ELEMENTS, Num Elements $NUM_ELEMENTS, Number $NUMBER, Size 200"
      ;;
    "ai-classification")
      TIME_TAKEN=$((RANDOM % 500 + 100))
      INPUT_TOKENS=$((RANDOM % 2000 + 500))
      OUTPUT_TOKENS=$((RANDOM % 100 + 5))
      CATEGORY=${CATEGORIES[$RANDOM % ${#CATEGORIES[@]}]}
      CONFIDENCE=$(awk -v min=0.7 -v max=1.0 'BEGIN{srand(); print min+rand()*(max-min)}')
      INTENT=${INTENTS[$RANDOM % ${#INTENTS[@]}]}
      MESSAGE="com.bigcompany.analytics.ai.Classification Query Classification Response: usage_metadata=UsageMetadata(time_taken_ms=$TIME_TAKEN, input_tokens=$INPUT_TOKENS, output_tokens=$OUTPUT_TOKENS, llm='vertex_gemini25_flash_lite') classification=QueryClassification(category='$CATEGORY', confidence=$CONFIDENCE, intent='$INTENT')"
      ;;
    "api-gateway")
      METHOD=${HTTP_METHODS[$RANDOM % ${#HTTP_METHODS[@]}]}
      PATH=${HTTP_PATHS[$RANDOM % ${#HTTP_PATHS[@]}]}
      LIMIT=$((RANDOM % 100))
      OFFSET=$((RANDOM % 1000))
      HEADERS_COUNT=$((RANDOM % 20 + 5))
      BODY_SIZE=$((RANDOM % 5000 + 100))
      CLIENT_IP="10.0.$((RANDOM % 255)).$((RANDOM % 255))"
      REQUEST_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
      MESSAGE="com.bigcompany.api.gateway.RequestHandler - Processing HTTP request: method=$METHOD path=$PATH query_params=limit=$LIMIT&offset=$OFFSET headers_count=$HEADERS_COUNT body_size=$BODY_SIZE client_ip=$CLIENT_IP user_agent=\"Mozilla/5.0\" request_id=$REQUEST_ID"
      ;;
    "database-pool")
      ACTIVE_CONN=$((RANDOM % 50 + 10))
      IDLE_CONN=$((RANDOM % 30 + 5))
      WAIT_COUNT=$((RANDOM % 10))
      TOTAL_REQUESTS=$((RANDOM % 10000 + 1000))
      AVG_WAIT=$((RANDOM % 50 + 5))
      MESSAGE="com.bigcompany.database.ConnectionPool - Database connection pool status: active_connections=$ACTIVE_CONN idle_connections=$IDLE_CONN max_pool_size=100 wait_count=$WAIT_COUNT total_requests=$TOTAL_REQUESTS avg_wait_time_ms=$AVG_WAIT connection_timeout_ms=5000"
      ;;
    "cache-service")
      OPERATION=${CACHE_OPS[$RANDOM % ${#CACHE_OPS[@]}]}
      CACHE_KEY="user:session:$((RANDOM % 10000))"
      HIT=$((RANDOM % 2))
      TTL=$((RANDOM % 3600 + 60))
      SIZE_BYTES=$((RANDOM % 10000 + 100))
      LATENCY=$((RANDOM % 10 + 1))
      NODE="redis-node-$((RANDOM % 5 + 1))"
      MESSAGE="com.bigcompany.cache.RedisClient - Cache operation completed: operation=$OPERATION key=$CACHE_KEY hit=$HIT ttl_seconds=$TTL size_bytes=$SIZE_BYTES latency_ms=$LATENCY cluster_node=$NODE"
      ;;
    "kafka-consumer")
      CATEGORY=${CATEGORIES[$RANDOM % ${#CATEGORIES[@]}]}
      TOPIC="events.$CATEGORY"
      PARTITION=$((RANDOM % 10))
      OFFSET=$((RANDOM % 1000000))
      KEY="key-$((RANDOM % 1000))"
      VALUE_SIZE=$((RANDOM % 5000 + 100))
      LAG=$((RANDOM % 100))
      CONSUMER_GROUP="consumer-group-$((RANDOM % 3 + 1))"
      PROCESSING_TIME=$((RANDOM % 200 + 10))
      MESSAGE="com.bigcompany.messaging.KafkaConsumer - Message consumed from topic: topic=$TOPIC partition=$PARTITION offset=$OFFSET key=$KEY value_size=$VALUE_SIZE lag=$LAG consumer_group=$CONSUMER_GROUP processing_time_ms=$PROCESSING_TIME"
      ;;
    "auth-service")
      USERNAME="user$((RANDOM % 1000))"
      ROLES="[admin,user]"
      TOKEN_TYPE="Bearer"
      EXPIRES_IN=$((RANDOM % 3600 + 300))
      VALIDATION_TIME=$((RANDOM % 50 + 5))
      MESSAGE="com.bigcompany.auth.TokenValidator - JWT token validation: user_id=$USER_ID username=$USERNAME roles=$ROLES token_type=$TOKEN_TYPE expires_in=$EXPIRES_IN issued_at=$TIMESTAMP issuer=auth.bigcompany.com validation_time_ms=$VALIDATION_TIME"
      ;;
    "job-executor")
      CATEGORY=${CATEGORIES[$RANDOM % ${#CATEGORIES[@]}]}
      JOB_NAME="cleanup_${CATEGORY}_job"
      JOB_ID="job-$((RANDOM % 1000))"
      STATUS=${JOB_STATUSES[$RANDOM % ${#JOB_STATUSES[@]}]}
      DURATION=$((RANDOM % 30000 + 1000))
      RETRY_COUNT=$((RANDOM % 3))
      NEXT_RUN=$(date -u -d "+6 hours" +"%Y-%m-%dT%H:%M:%SZ")
      MESSAGE="com.bigcompany.scheduler.JobExecutor - Scheduled job execution: job_name=$JOB_NAME job_id=$JOB_ID status=$STATUS duration_ms=$DURATION retry_count=$RETRY_COUNT next_run=$NEXT_RUN cron_expression=\"0 */6 * * *\""
      ;;
  esac

  # Create JSON log entry in ndjson format (one line per log)
  LOG_ENTRY="{\"_time\":\"$TIMESTAMP\",\"_msg\":\"$MESSAGE\",\"level\":\"$LEVEL\",\"service\":\"$SERVICE\",\"host\":\"$HOST\",\"region\":\"$REGION\",\"trace_id\":\"$TRACE_ID\",\"span_id\":\"$SPAN_ID\",\"user_id\":\"$USER_ID\",\"request_id\":\"$(uuidgen | tr '[:upper:]' '[:lower:]')\",\"duration_ms\":$((RANDOM % 1000))}"

  # Send log to VictoriaLogs
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$VICTORIALOGS_URL" \
    -H "Content-Type: application/stream+json" \
    -d "$LOG_ENTRY")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

  COUNT=$((COUNT + 1))

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    # Truncate message for display
    DISPLAY_MSG=$(echo "$MESSAGE" | cut -c1-80)
    if [ ${#MESSAGE} -gt 80 ]; then
      DISPLAY_MSG="${DISPLAY_MSG}..."
    fi
    echo "[$COUNT] ✓ Log sent: $LEVEL | $SERVICE | $DISPLAY_MSG"
  else
    echo "[$COUNT] ✗ Failed to send log (HTTP $HTTP_CODE)"
  fi

  # Wait a bit before sending next log (adjust as needed)
  sleep 0.5
done

