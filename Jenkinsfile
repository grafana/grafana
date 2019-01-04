def ORG = "mayadata"
//def STAGING_KEYPATH="~jenkins/.ssh/id_rsa_control_node_staging"
//def PROD_KEYPATH="~jenkins/.ssh/id_rsa_control_node_production"
//def PREPROD_KEYPATH="~jenkins/.ssh/id_rsa_control_node_preproduction"
//def CONTROL_NODE="35.225.61.42"
def REPO = "maya-grafana"
def DOCKER_HUB_REPO = "https://index.docker.io/v1/"
def DOCKER_IMAGE = ""
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
	        script {
	            GIT_SHA = sh(
		                 returnStdout: true,
				 script: "git log -n 1 --pretty=format:'%h'"
				).trim()

		    sh 'env > env.txt'
		    for (String i : readFile('env.txt').split("\r?\n")) {
		        println i
		    }

		    echo "Checked out branch: ${env.BRANCH_NAME}"

                    if (env.BRANCH_NAME == 'staging-mo-grafana' || env.BRANCH_NAME == 'mo-grafana' || env.BRANCH_NAME.startsWith('alpha-r')) {
                        echo 'I only execute on the ${env.BRANCH_NAME} branch'
			            DOCKER_IMAGE = docker.build("${ORG}/${REPO}:${env.BRANCH_NAME}-${GIT_SHA}")
                    } else {
                        echo 'I execute on non (master|alpha-rX|staging) branches'
                    }

                }
	    }
        }


        stage('Push to DockerHub') {
            steps {
		    script {
		        echo "Checked out build number: ${env.BUILD_NUMBER}"
		        docker.withRegistry('https://registry.hub.docker.com', 'ddc3fdf7-5611-4d47-a8ab-d0ea7624671a') {
                            if (env.BRANCH_NAME == 'staging-mo-grafana' || env.BRANCH_NAME == 'mo-grafana' || env.BRANCH_NAME.startsWith('alpha-r')) {
		                echo "Pushing the image with the tag..."
                                sh "docker login --username=mayadata --password=MayaDocker@123 && docker push ${ORG}/${REPO}:${BRANCH_NAME}-${GIT_SHA}"
				//DOCKER_IMAGE.push()
                            } else {
			        echo "WARNING: Not pushing ks"
                            }
		        }
		    }
	    }
         }

/*         stage('Deploy on the related k8s cluster') {
            steps {
                script {
                    if (env.BRANCH_NAME == 'staging') {
                        // Deploy to staging cluster
                        echo "${env.BRANCH_NAME}-${GIT_SHA}"
                        sh "ssh -i ${STAGING_KEYPATH} staging@${CONTROL_NODE} \" /home/staging/install.sh chat-server \"${env.BRANCH_NAME}-${GIT_SHA}\"\""
                    } else if (env.BRANCH_NAME == 'master') {
                        // Deploy to production cluster
                        sh "ssh -i ${PROD_KEYPATH} production@${CONTROL_NODE} \" /home/production/install.sh chat-server \"${env.BRANCH_NAME}-${GIT_SHA}\"\""
                    } else if(env.BRANCH_NAME.startsWith('alpha-r') || env.BRANCH_NAME == 'release') {
                        // Deploy to pre-production cluster
                        sh "ssh -i ${PREPROD_KEYPATH} preproduction@${CONTROL_NODE} \" /home/preproduction/install.sh chat-server \"${env.BRANCH_NAME}-${GIT_SHA}\"\""
                    } else {
                        echo "Not sure what to do with this branch. So nto deploying. Mya be dev branch ?"
                    }
                }
             }
         } */
    } 

    post {
        always {
            echo 'This will always run'
        }
        success {
            echo 'This will run only if successful'
            /* slackSend channel: '#maya-chatops',
                   color: 'good',
                   message: "The pipeline ${currentBuild.fullDisplayName} completed successfully :dance: :thumbsup: " */
        }
        failure {
            echo 'This will run only if failed'
            /* slackSend channel: '#maya-chatops',
                  color: 'RED',
                  message: "The pipeline ${currentBuild.fullDisplayName} failed. :scream_cat: :japanese_goblin: " */
        }
        unstable {
            echo 'This will run only if the run was marked as unstable'
        }
        changed {
            echo 'This will run only if the state of the Pipeline has changed'
            echo 'For example, if the Pipeline was previously failing but is now successful'
        }
    }
}
